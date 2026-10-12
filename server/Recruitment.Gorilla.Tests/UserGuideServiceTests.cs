using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

public class UserGuideServiceTests
{
    [Theory]
    [InlineData(new[] { Roles.Interviewer }, "interviewer")]
    [InlineData(new[] { Roles.Recruiter }, "recruiter")]
    [InlineData(new[] { Roles.Admin }, "admin")]
    [InlineData(new[] { Roles.SuperAdmin }, "superadmin")]
    [InlineData(new string[0], "interviewer")]
    public void EditionFor_resolves_the_expected_edition(string[] roles, string expected) =>
        Assert.Equal(expected, UserGuideService.EditionFor(roles));

    [Fact]
    public void EditionFor_the_highest_role_present_wins()
    {
        Assert.Equal("superadmin", UserGuideService.EditionFor([Roles.Interviewer, Roles.SuperAdmin]));
        Assert.Equal("admin", UserGuideService.EditionFor([Roles.Recruiter, Roles.Admin]));
        Assert.Equal("recruiter", UserGuideService.EditionFor([Roles.Interviewer, Roles.Recruiter]));
    }

    [Fact]
    public void Interviewer_edition_excludes_recruiter_admin_and_super_admin_chapters()
    {
        var guide = new UserGuideService().Get([Roles.Interviewer]);

        Assert.Equal("interviewer", guide.Edition);
        var all = string.Join("\n\n", guide.Chapters.Select(c => c.Markdown));
        Assert.DoesNotContain("Chapter 2: Recruiter guide", all);
        Assert.DoesNotContain("Chapter 3: Admin guide", all);
        Assert.DoesNotContain("Chapter 4: Super Admin guide", all);
        Assert.Contains("Chapter 0: Getting started", all);
        Assert.Contains("Chapter 1: Interviewer guide", all);
        Assert.Contains("Chapter 5: Appendix", all);
    }

    [Fact]
    public void Recruiter_edition_adds_the_recruiter_chapter_only()
    {
        var guide = new UserGuideService().Get([Roles.Recruiter]);

        var all = string.Join("\n\n", guide.Chapters.Select(c => c.Markdown));
        Assert.Contains("Chapter 2: Recruiter guide", all);
        Assert.DoesNotContain("Chapter 3: Admin guide", all);
        Assert.DoesNotContain("Chapter 4: Super Admin guide", all);
    }

    [Fact]
    public void Admin_edition_adds_the_admin_chapter_but_not_super_admins()
    {
        var guide = new UserGuideService().Get([Roles.Admin]);

        var all = string.Join("\n\n", guide.Chapters.Select(c => c.Markdown));
        Assert.Contains("Chapter 2: Recruiter guide", all);
        Assert.Contains("Chapter 3: Admin guide", all);
        Assert.DoesNotContain("Chapter 4: Super Admin guide", all);
    }

    [Fact]
    public void SuperAdmin_edition_contains_every_chapter()
    {
        var guide = new UserGuideService().Get([Roles.SuperAdmin]);

        var all = string.Join("\n\n", guide.Chapters.Select(c => c.Markdown));
        Assert.Equal(7, guide.Chapters.Count);
        Assert.Contains("Chapter 0: Getting started", all);
        Assert.Contains("Chapter 1: Interviewer guide", all);
        Assert.Contains("Chapter 2: Recruiter guide", all);
        Assert.Contains("Chapter 3: Admin guide", all);
        Assert.Contains("Chapter 4: Super Admin guide", all);
        Assert.Contains("Chapter 5: Appendix", all);
    }

    [Fact]
    public void Every_chapter_has_a_non_empty_title_and_body()
    {
        var guide = new UserGuideService().Get([Roles.SuperAdmin]);

        foreach (var chapter in guide.Chapters)
        {
            Assert.False(string.IsNullOrWhiteSpace(chapter.Id));
            Assert.False(string.IsNullOrWhiteSpace(chapter.Title));
            Assert.False(string.IsNullOrWhiteSpace(chapter.Markdown));
        }
    }

    [Fact]
    public void Repeated_calls_for_the_same_edition_return_equal_content()
    {
        var service = new UserGuideService();
        var first = service.Get([Roles.Admin]);
        var second = service.Get([Roles.Admin]);

        Assert.Equal(first.Chapters.Count, second.Chapters.Count);
        Assert.Equal(first.Chapters[0].Markdown, second.Chapters[0].Markdown);
    }
}
