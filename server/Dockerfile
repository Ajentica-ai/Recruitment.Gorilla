FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Recruitment.Gorilla.slnx .
COPY Recruitment.Gorilla.API/Recruitment.Gorilla.API.csproj Recruitment.Gorilla.API/
COPY Recruitment.Gorilla.Tests/Recruitment.Gorilla.Tests.csproj Recruitment.Gorilla.Tests/
RUN dotnet restore Recruitment.Gorilla.API/Recruitment.Gorilla.API.csproj

COPY . .
RUN dotnet publish Recruitment.Gorilla.API/Recruitment.Gorilla.API.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

# ASPNETCORE_URLS is set to 8081 in Compose so the container need not run as root
# to bind a privileged port. RG's "loopback-only" golden rule is honored at the
# network layer instead: this image declares no `ports:` in Compose, so it is
# reachable only from the gateway over the internal bridge network.
EXPOSE 8081

ENTRYPOINT ["dotnet", "Recruitment.Gorilla.API.dll"]
