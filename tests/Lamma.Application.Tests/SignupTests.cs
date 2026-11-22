using Lamma.Application.Common.Email;
using Lamma.Application.Signup;

namespace Lamma.Application.Tests;

public sealed class SignupUnitTests
{
    [Fact]
    public void Tokens_are_random_url_safe_and_only_their_hash_is_kept()
    {
        var (token, hash) = InviteTokens.Generate();
        var (other, _) = InviteTokens.Generate();
        Assert.NotEqual(token, other);
        Assert.Equal(43, token.Length); // 32 bytes, base64url without padding
        Assert.DoesNotContain('+', token);
        Assert.DoesNotContain('/', token);
        Assert.Equal(64, hash.Length);
        Assert.Equal(hash, InviteTokens.Hash(token));
        Assert.NotEqual(token, hash);
    }

    [Fact]
    public void Invitation_email_is_rtl_branded_and_escapes_user_text()
    {
        var m = EmailTemplates.Invitation("a@b.c", "<script>ريم</script> الخطيب", "متجر \"<b>\"", "https://app/register?token=abc&x=1", 72);
        Assert.Equal(("a@b.c", EmailTemplates.InvitationKind, "https://app/register?token=abc&x=1"), (m.To, m.Kind, m.Link));
        Assert.Contains("dir=\"rtl\"", m.Html);
        Assert.Contains("&lt;script&gt;ريم&lt;/script&gt;", m.Html);
        Assert.DoesNotContain("<script>", m.Html);
        Assert.Contains("href=\"https://app/register?token=abc&amp;x=1\"", m.Html);
        Assert.Contains("72 ساعة", m.Text);
        Assert.Contains("https://app/register?token=abc&x=1", m.Text);
    }

    [Theory]
    [InlineData("pass1234", "pass1234", true)]
    [InlineData("pass1234", "pass1235", false)]
    [InlineData("short1", "short1", false)]
    public void Register_needs_a_matching_valid_password(string password, string confirm, bool valid)
        => Assert.Equal(valid, new RegisterRequestValidator().Validate(new RegisterRequest("t", password, confirm)).IsValid);
}
