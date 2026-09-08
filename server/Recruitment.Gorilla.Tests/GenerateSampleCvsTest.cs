using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Recruitment.Gorilla.Tests;

public class GenerateSampleCvsTest
{
    public GenerateSampleCvsTest()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    [Fact]
    public void Generate_10_Sample_Cvs()
    {
        var outputDir = @"C:\Ajentica\Projects\Recruitment.Gorilla\client\e2e\test-cvs";
        Directory.CreateDirectory(outputDir);

        var candidates = new (string Name, string Role, string Email, string Phone, string LinkedIn, string GitHub, string[] Skills, string Summary)[]
        {
            (
                "Alex Rivera",
                "Senior Backend Engineer",
                "alex.rivera@techhire.dev",
                "+1 (555) 234-5678",
                "https://linkedin.com/in/alex-rivera-dev",
                "https://github.com/alex-rivera",
                new[] { "C#", ".NET", "ASP.NET Core", "Azure", "PostgreSQL", "Docker", "Microservices" },
                "Senior Backend Engineer with 7+ years of experience building resilient distributed microservices, REST APIs, and event-driven architectures on Azure."
            ),
            (
                "Samantha Chen",
                "Full Stack Developer",
                "samantha.chen@webdevs.io",
                "+1 (555) 345-6789",
                "https://linkedin.com/in/samantha-chen-tech",
                "https://github.com/samantha-chen",
                new[] { "React", "TypeScript", "Node.js", "GraphQL", "TailwindCSS", "Next.js", "Jest" },
                "Full Stack Engineer passionate about high-performance web applications, responsive component design systems, and seamless user experiences."
            ),
            (
                "Marcus Vance",
                "DevOps & Cloud Architect",
                "marcus.vance@cloudnative.net",
                "+1 (555) 456-7890",
                "https://linkedin.com/in/marcus-vance-cloud",
                "https://github.com/marcus-vance",
                new[] { "AWS", "Kubernetes", "Docker", "Terraform", "CI/CD", "Prometheus", "Linux" },
                "Cloud Solutions Architect with 9+ years optimizing high-availability cloud infrastructure, automated GitOps pipelines, and zero-downtime deployments."
            ),
            (
                "Elena Rostova",
                "Frontend Engineer",
                "elena.rostova@designsystems.io",
                "+1 (555) 567-8901",
                "https://linkedin.com/in/elena-rostova-fe",
                "https://github.com/elena-rostova",
                new[] { "React", "TypeScript", "Redux", "CSS", "Vite", "HTML5", "Accessibility" },
                "Frontend Engineer focused on modern React component libraries, accessibility compliance (WCAG 2.1), and rapid interactive prototyping."
            ),
            (
                "Tariq Al-Mansoor",
                "Data Engineer",
                "tariq.mansoor@datalake.ai",
                "+1 (555) 678-9012",
                "https://linkedin.com/in/tariq-al-mansoor",
                "https://github.com/tariq-mansoor",
                new[] { "Python", "Apache Spark", "SQL", "PostgreSQL", "Snowflake", "Docker", "Airflow" },
                "Data Engineer experienced in designing petabyte-scale data pipelines, ETL automation with Airflow, and real-time analytical reporting."
            ),
            (
                "Chloe Bennett",
                "UI/UX & Frontend Developer",
                "chloe.bennett@creativetech.co",
                "+1 (555) 789-0123",
                "https://linkedin.com/in/chloe-bennett-ux",
                "https://github.com/chloe-bennett",
                new[] { "Figma", "React", "TypeScript", "CSS3", "Design Systems", "User Research" },
                "Hybrid Product Designer and UI Developer crafting intuitive, accessible enterprise interfaces with modern TypeScript and React."
            ),
            (
                "David Kim",
                "Mobile & Web Applications Engineer",
                "david.kim@appsolutions.dev",
                "+1 (555) 890-1234",
                "https://linkedin.com/in/david-kim-apps",
                "https://github.com/david-kim",
                new[] { "React Native", "TypeScript", "React", "C#", "Firebase", "Redux", "iOS" },
                "Mobile Applications Developer with track record delivering cross-platform iOS and Android apps alongside robust web dashboards."
            ),
            (
                "Priya Patel",
                "Lead QA Automation Engineer",
                "priya.patel@qualityfirst.io",
                "+1 (555) 901-2345",
                "https://linkedin.com/in/priya-patel-qa",
                "https://github.com/priya-patel",
                new[] { "Playwright", "Selenium", "TypeScript", "C#", "CI/CD", "xUnit", "Jest" },
                "QA Automation Architect with deep expertise in end-to-end testing frameworks, API performance testing, and continuous deployment validation."
            ),
            (
                "Jordan Lee",
                "Systems & Security Engineer",
                "jordan.lee@infosec-defense.org",
                "+1 (555) 012-3456",
                "https://linkedin.com/in/jordan-lee-sec",
                "https://github.com/jordan-lee",
                new[] { "Linux", "Python", "Docker", "AWS", "Security Auditing", "Bash", "OAuth2" },
                "Cybersecurity Engineer specializing in infrastructure hardening, vulnerability assessments, automated compliance, and identity management."
            ),
            (
                "Sophia Taylor",
                "Principal Solutions Architect",
                "sophia.taylor@enterprise-arch.com",
                "+1 (555) 123-4560",
                "https://linkedin.com/in/sophia-taylor-arch",
                "https://github.com/sophia-taylor",
                new[] { ".NET", "C#", "Azure", "Microservices", "System Design", "SQL Server", "Kafka" },
                "Principal Architect guiding enterprise digital transformation, cloud migrations, scalable microservices architectures, and technical hiring strategy."
            )
        };

        foreach (var (name, role, email, phone, linkedin, github, skills, summary) in candidates)
        {
            var safeRole = role.Replace(' ', '_').Replace("&", "and").Replace('/', '_');
            var safeName = name.Replace(' ', '_');
            var fileName = $"{safeName}_{safeRole}.pdf";
            var filePath = Path.Combine(outputDir, fileName);

            var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(36);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(11).FontColor(Colors.Grey.Darken3));

                    page.Content().Column(col =>
                    {
                        col.Spacing(10);

                        col.Item().Text(name).FontSize(24).Bold().FontColor(Colors.Blue.Darken3);
                        col.Item().Text(role).FontSize(14).SemiBold().FontColor(Colors.Grey.Darken2);
                        col.Item().Text($"Email: {email}   |   Phone: {phone}   |   Location: Dhaka, Bangladesh");
                        col.Item().Text($"LinkedIn: {linkedin}   |   GitHub: {github}");
                        col.Item().Text($"LeetCode: https://leetcode.com/u/{safeName.ToLower()}   |   Codeforces: https://codeforces.com/profile/{safeName.ToLower()}");

                        col.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                        // Summary Section
                        col.Item().Text("Summary").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);
                        col.Item().Text(summary);

                        // Skills Section
                        col.Item().Text("Skills & Technologies").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);
                        col.Item().Text(string.Join(", ", skills));

                        // Experience Section
                        col.Item().Text("Professional Experience").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);
                        col.Item().Text($"{role} — Brain Station 23 (2020 – Present)");
                        col.Item().Text("• Led key architectural initiatives resulting in high scalability and reliability.");
                        col.Item().Text("• Collaborated with engineering teams to build modern cloud native systems.");
                        col.Item().Text("• Mentored team members and maintained high code quality standards.");

                        // Education
                        col.Item().Text("Education").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);
                        col.Item().Text("BSc in Computer Science & Engineering — Bangladesh University of Engineering and Technology (2020)");
                        col.Item().Text("CGPA: 3.85 / 4.00");
                    });
                });
            });

            doc.GeneratePdf(filePath);
        }
    }
}
