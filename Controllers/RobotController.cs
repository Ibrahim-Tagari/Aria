using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.RateLimiting;

namespace AiRobotDemo.Controllers
{
    [EnableRateLimiting("chat")]
    public class RobotController : Controller
    {
        private readonly OpenAiService _ai;
        private const int MAX_INPUT = 1000;

        public RobotController(OpenAiService ai) { _ai = ai; }

        public IActionResult Index() => View();

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task AskStream([FromBody] ChatRequest? req)
        {
            if (!Validate(req?.Text, out var clean, out var errMsg))
            {
                Response.StatusCode = 400;
                await Response.WriteAsJsonAsync(new { error = errMsg });
                return;
            }

            // Use the client's local date/time (sent by the browser) so the
            // answer is correct for the user's timezone — not the server's.
            // Fall back to server time only if the client didn't supply it.
            var clientDatetime = SanitiseShort(req?.ClientDatetime ?? "");
            var clientTz = SanitiseShort(req?.ClientTz ?? "");

            var history = req?.History?
                .Select(h => new ConversationTurn
                {
                    User = Sanitise(h.User ?? ""),
                    Assistant = Sanitise(h.Assistant ?? "")
                }).ToList();

            Response.ContentType = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["X-Accel-Buffering"] = "no";

            try
            {
                await foreach (var token in _ai.AskStream(clean, history, clientDatetime, clientTz, HttpContext.RequestAborted))
                {
                    await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { token })}\n\n");
                    await Response.Body.FlushAsync();
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception)
            {
                await Response.WriteAsync(
                    $"data: {JsonSerializer.Serialize(new { error = "An internal server error occurred." })}\n\n");
                await Response.Body.FlushAsync();
            }

            await Response.WriteAsync("data: [DONE]\n\n");
            await Response.Body.FlushAsync();
        }

        [HttpPost]
        public async Task<IActionResult> Ask([FromBody] ChatRequest? req)
        {
            if (!Validate(req?.Text, out var clean, out var errMsg))
                return BadRequest(new { error = errMsg });

            var clientDatetime = SanitiseShort(req?.ClientDatetime ?? "");
            var clientTz = SanitiseShort(req?.ClientTz ?? "");

            try
            {
                return Json(new { text = await _ai.Ask(clean, null, clientDatetime, clientTz) });
            }
            catch (Exception) { return StatusCode(500, new { error = "An internal server error occurred" }); }
        }

        [HttpPost]
        [EnableRateLimiting("transcribe")]
        [DisableRequestSizeLimit]
        [RequestFormLimits(MultipartBodyLengthLimit = 26_000_000)]
        public async Task<IActionResult> Transcribe(IFormFile? audio)
        {
            if (audio == null || audio.Length == 0)
                return BadRequest(new { error = "No audio file provided." });
            if (audio.Length > 25 * 1024 * 1024)
                return BadRequest(new { error = "File too large (max 25 MB)." });

            var ct = (audio.ContentType ?? "audio/webm").ToLowerInvariant();
            if (!ct.StartsWith("audio/") && ct != "video/webm")
                return BadRequest(new { error = $"Unsupported format: {ct}" });

            try
            {
                using var ms = new MemoryStream();
                await audio.CopyToAsync(ms);
                var transcript = await _ai.Transcribe(ms.ToArray(), "recording.webm");
                return Json(new { transcript });
            }
            catch (Exception) { return StatusCode(500, new { error = "An internal server error occurred" }); }
        }

        private static bool Validate(string? t, out string clean, out string err)
        {
            clean = ""; err = "";
            if (string.IsNullOrWhiteSpace(t)) { err = "No message provided."; return false; }
            clean = Sanitise(t);
            if (clean.Length > MAX_INPUT) { err = $"Message too long (max {MAX_INPUT} chars)."; return false; }
            return true;
        }

        private static string Sanitise(string s) =>
            Regex.Replace(s.Replace("\0", ""), "<[^>]+>", "").Trim();

        // For short metadata fields — strip anything suspicious, cap length
        private static string SanitiseShort(string s) =>
            Regex.Replace(s.Replace("\0", ""), "[^\\w\\s:,/+-]", "").Trim().Length > 80
                ? "" : Regex.Replace(s.Replace("\0", ""), "[^\\w\\s:,/+-]", "").Trim();

        private static string SafeMsg(string m)
        {
            if (m.Contains("gsk_", StringComparison.OrdinalIgnoreCase) ||
                m.Contains("ApiKey", StringComparison.OrdinalIgnoreCase))
                return "Authentication error — check Groq API key in appsettings.json.";
            return m.Length > 300 ? m[..300] + "…" : m;
        }
    }

    public class ChatRequest
    {
        public string? Text { get; set; }
        public List<HistoryItem>? History { get; set; }
        public string? ClientDatetime { get; set; }   // e.g. "Saturday 14 June 2025, 3:42 PM"
        public string? ClientTz { get; set; }   // e.g. "Africa/Johannesburg"
    }
    public class HistoryItem
    {
        public string? User { get; set; }
        public string? Assistant { get; set; }
    }
}