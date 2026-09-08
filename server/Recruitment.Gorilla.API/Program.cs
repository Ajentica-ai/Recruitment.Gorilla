using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Authorization;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Hubs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.API.Services.Background;

var builder = WebApplication.CreateBuilder(args);

// Write log files under the project's Logs/ folder (referenced by log4net.config as %env{RG_LOG_DIR}).
Environment.SetEnvironmentVariable(
    "RG_LOG_DIR", Path.Combine(builder.Environment.ContentRootPath, "Logs"));

builder.Logging.ClearProviders();
builder.Logging.AddLog4Net("log4net.config");

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connStr = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connStr))
    throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection is not configured. " +
        "Set it via user secrets (dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"...\") " +
        "or environment variables.");

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseMySql(connStr, ServerVersion.AutoDetect(connStr)));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CandidateService>();
builder.Services.AddScoped<CVParserService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<StatusOptionService>();
builder.Services.AddScoped<ConfigurationService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<InterviewService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<OfferService>();
builder.Services.AddScoped<EvaluationRubricService>();
builder.Services.AddScoped<AnalyticsService>();
builder.Services.AddScoped<CandidateDraftService>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddSingleton<IEmailQueue, EmailQueue>();
builder.Services.AddHostedService<EmailQueueWorker>();
builder.Services.AddSingleton<IAuditLogQueue, AuditLogQueue>();
builder.Services.AddHostedService<AuditLogBatchWorker>();
builder.Services.AddScoped<ICVUploadProgressNotifier, CVUploadProgressNotifier>();
builder.Services.AddSignalR();
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
builder.Services.AddScoped<ISmtpTransport, MailKitSmtpTransport>();
builder.Services.AddSingleton<SecretProtector>();
builder.Services.AddScoped<IEmailSettingsResolver, EmailSettingsResolver>();
builder.Services.AddScoped<EmailSettingsService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddSingleton<IAuthorizationHandler, PasswordChangedHandler>();

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured. Set it via user secrets.");
if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 bytes (256 bits) for HS256.");

// Root key for encrypting secrets stored at rest (the in-app SMTP password). Must be stable across
// restarts/containers, else stored ciphertext becomes undecryptable.
var encryptionKey = builder.Configuration["Encryption:Key"]
    ?? throw new InvalidOperationException(
        "Encryption:Key is not configured. Set it via user secrets " +
        "(dotnet user-secrets set \"Encryption:Key\" \"<32+ char random string>\") or environment variables.");
if (Encoding.UTF8.GetByteCount(encryptionKey) < 16)
    throw new InvalidOperationException("Encryption:Key must be at least 16 characters.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256], // pin algorithm (prevents alg-confusion)
            ClockSkew = TimeSpan.Zero,
            NameClaimType = JwtRegisteredClaimNames.Sub,
            RoleClaimType = ClaimTypes.Role,
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// Default-deny: every endpoint requires an authenticated user (unless [AllowAnonymous]),
// and a user with a pending forced password change is blocked from all but the
// change-password endpoint.
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .AddRequirements(new PasswordChangedRequirement())
        .Build());

var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p => p.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// The CV upload progress hub. Everything around it already assumed this line
// existed — the client connects to /hubs/cv-upload, the JWT handler above
// reads the token off the query string specifically for paths under /hubs, and
// CVUploadProgressNotifier is registered and injected with IHubContext — but
// the endpoint was never mapped, so every negotiate returned 404 and the
// live parsing progress never arrived.
app.MapHub<CVUploadHub>("/hubs/cv-upload");

// Apply pending migrations and seed the first Super Admin from config (once, when the
// Users table is empty). The seed reuses the existing Auth:PasswordHash so the current
// admin keeps its password, now logging in by email.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    var email = app.Configuration["Auth:SeedAdminEmail"] ?? "admin@recruitmentgorilla.com";
    var passwordHash = app.Configuration["Auth:PasswordHash"];
    var adminUser = await db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Email == email);
    if (adminUser is null)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            app.Logger.LogWarning(
                "No users exist and Auth:PasswordHash is not configured — no Super Admin was seeded.");
        }
        else
        {
            var name = app.Configuration["Auth:SeedAdminName"] ?? "Super Admin";
            db.Users.Add(new User
            {
                Name = name,
                Email = email,
                PasswordHash = passwordHash,
                MustChangePassword = false,
                IsActive = true,
                Roles = [new UserRole { Role = Roles.SuperAdmin }],
            });
            await db.SaveChangesAsync();
            app.Logger.LogInformation("Seeded initial Super Admin '{Email}'.", email);
        }
    }
    else if (!string.IsNullOrWhiteSpace(passwordHash) && adminUser.PasswordHash != passwordHash)
    {
        adminUser.PasswordHash = passwordHash;
        await db.SaveChangesAsync();
        app.Logger.LogInformation("Updated Super Admin '{Email}' password hash from configuration.", email);
    }
}

app.Logger.LogInformation("Recruitment.Gorilla API starting in {Environment} environment.",
    app.Environment.EnvironmentName);

app.Run();

// Exposes the implicit top-level Program class to the test project (WebApplicationFactory<Program>).
public partial class Program;
