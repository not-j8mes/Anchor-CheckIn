import { Resend } from "resend";

type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

type EmailTransport = {
  send(payload: EmailPayload): Promise<unknown>;
};

export type RegistrationConfirmationEmailInput = {
  to?: string | null;
  organizationName: string;
  eventName: string;
  eventDate?: string | null;
  eventEndDate?: string | null;
  eventScheduleType?: string | null;
  primaryContactName?: string | null;
  participantNames?: string[];
  subjectTemplate?: string | null;
  messageTemplate?: string | null;
  replyTo?: string | null;
};

export type EventRegistrantEmailInput = RegistrationConfirmationEmailInput;

let testTransport: EmailTransport | null = null;

export function setEmailTransportForTests(transport: EmailTransport | null) {
  testTransport = transport;
}

function normalizeEmail(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatEventDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startDate}-${endDate}`;

  const startMonth = start.toLocaleDateString("en-US", { month: "long" });
  const endMonth = end.toLocaleDateString("en-US", { month: "long" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear && startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}, ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startMonth} ${startDay}-${endMonth} ${endDay}, ${startYear}`;
  }
  return `${startMonth} ${startDay}, ${startYear}-${endMonth} ${endDay}, ${endYear}`;
}

function formatEventDateDisplay(input: {
  startDate?: string | null;
  endDate?: string | null;
  scheduleType?: string | null;
}): string | null {
  const startDate = input.startDate ?? null;
  const endDate = input.endDate ?? null;
  if (!startDate) return null;

  const formattedStart = formatEventDate(startDate) ?? startDate;
  if (input.scheduleType === "repeating") return `Starts ${formattedStart}`;
  if (endDate && endDate !== startDate) return formatDateRange(startDate, endDate);
  return formattedStart;
}

function formatNameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function stripFormatting(value: string): string {
  return value
    .replace(/\[(small|normal|large)\]([\s\S]*?)\[\/\1\]/g, "$2")
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/_([\s\S]*?)_/g, "$1");
}

function renderFormattedHtml(value: string): string {
  return escapeHtml(value)
    .replace(/\[(small|normal|large)\]([\s\S]*?)\[\/\1\]/g, (_match, size: string, content: string) => {
      const fontSize = size === "small" ? "13px" : size === "large" ? "18px" : "16px";
      return `<span style="font-size: ${fontSize};">${content}</span>`;
    })
    .replace(/\*\*([\s\S]*?)\*\*/g, "<strong>$1</strong>")
    .replace(/_([\s\S]*?)_/g, "<em>$1</em>")
    .replaceAll("\n", "<br>");
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

function buildEmail(
  input: RegistrationConfirmationEmailInput,
  defaults?: {
    subjectTemplate?: string;
    messageTemplate?: string;
    footerText?: string;
    titleText?: string;
  },
): EmailPayload | null {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  const from = normalizeEmail(process.env["EMAIL_FROM"]);
  const to = normalizeEmail(input.to);

  if (!apiKey || !from || !to) return null;

  const eventDate = formatEventDateDisplay({
    startDate: input.eventDate,
    endDate: input.eventEndDate,
    scheduleType: input.eventScheduleType,
  });
  const replyTo = normalizeEmail(input.replyTo) ?? normalizeEmail(process.env["EMAIL_REPLY_TO"]);
  const participantNames = [...new Set((input.participantNames ?? []).map((name) => name.trim()).filter(Boolean))];
  const appBaseUrl = process.env["APP_BASE_URL"]?.trim();
  const templateValues = {
    organizationName: input.organizationName,
    eventName: input.eventName,
    eventDate: eventDate ?? "",
    primaryContactName: input.primaryContactName?.trim() ?? "",
    participantNames: formatNameList(participantNames),
    appBaseUrl: appBaseUrl ?? "",
  };
  const subject = renderTemplate(
    input.subjectTemplate?.trim() ||
      defaults?.subjectTemplate ||
      "Registration confirmed: {{eventName}}",
    templateValues,
  );
  const hasCustomMessage = Boolean(input.messageTemplate?.trim());
  const message = renderTemplate(
    input.messageTemplate?.trim() ||
      defaults?.messageTemplate ||
      "Your registration for {{eventName}} has been received.",
    templateValues,
  );
  const plainMessage = stripFormatting(message);
  const titleText = defaults?.titleText ?? "Registration confirmed";
  const greetingName = input.primaryContactName?.trim();
  const greeting = greetingName ? `Hi ${greetingName},` : "Hello,";
  const replyInstruction = replyTo
    ? "If you have questions, you can reply directly to this email."
    : "If you have questions, please contact the event organizer.";
  const footerText =
    defaults?.footerText ??
    "Thanks. We have your registration and will follow up if anything else is needed.";

  const summaryLines = [
    `Event: ${input.eventName}`,
    `Organization: ${input.organizationName}`,
    eventDate ? `Event date: ${eventDate}` : null,
    greetingName ? `Primary contact: ${greetingName}` : null,
    participantNames.length > 0 ? `Registered participants: ${formatNameList(participantNames)}` : null,
    appBaseUrl ? `Website: ${appBaseUrl}` : null,
  ].filter((line): line is string => line !== null);

  const lines = hasCustomMessage
    ? [
        plainMessage,
        "",
        "This email was sent because a registration was submitted.",
      ]
    : [
        titleText,
        "",
        greeting,
        "",
        plainMessage,
        "",
        ...summaryLines,
        "",
        replyInstruction,
        "",
        footerText,
        "",
        "This email was sent because a registration was submitted.",
      ];

  const details = [
    ["Event", input.eventName],
    ["Organization", input.organizationName],
    eventDate ? ["Event date", eventDate] : null,
    greetingName ? ["Primary contact", greetingName] : null,
    participantNames.length > 0 ? ["Registered participants", formatNameList(participantNames)] : null,
    appBaseUrl ? ["Website", appBaseUrl] : null,
  ].filter((row): row is [string, string] => row !== null);

  const html = [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
    `<title>${escapeHtml(titleText)}</title>`,
    "</head>",
    "<body style=\"margin: 0; padding: 0; background: #f6f7f9; font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.5;\">",
    "<div style=\"display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;\">",
    `${escapeHtml(stripFormatting(message)).slice(0, 160)}`,
    "</div>",
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"width: 100%; border-collapse: collapse; background: #f6f7f9;\">",
    "<tr>",
    "<td align=\"center\" style=\"padding: 28px 16px;\">",
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"width: 100%; max-width: 640px; border-collapse: collapse;\">",
    "<tr>",
    "<td style=\"padding: 0 0 14px; color: #475569; font-size: 14px; font-weight: 700; letter-spacing: 0;\">",
    `${escapeHtml(input.organizationName)}`,
    "</td>",
    "</tr>",
    "<tr>",
    "<td style=\"background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;\">",
    `<h1 style=\"margin: 0 0 18px; color: #0f172a; font-size: 28px; line-height: 1.2; font-weight: 700;\">${escapeHtml(titleText)}</h1>`,
    hasCustomMessage ? "" : `<p style=\"margin: 0 0 16px; font-size: 16px; color: #334155;\">${escapeHtml(greeting)}</p>`,
    `<p style=\"margin: 0 0 24px; font-size: 16px; color: #334155;\">${renderFormattedHtml(message)}</p>`,
    hasCustomMessage
      ? ""
      : [
          "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"width: 100%; border-collapse: collapse; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin: 0 0 24px;\">",
          ...details.map(
            ([label, value]) =>
              `<tr><td style=\"padding: 10px 16px 10px 0; color: #64748b; font-size: 14px; vertical-align: top; width: 34%;\">${escapeHtml(label)}</td><td style=\"padding: 10px 0; color: #0f172a; font-size: 14px; vertical-align: top;\">${escapeHtml(value)}</td></tr>`,
          ),
          "</table>",
          `<p style=\"margin: 0 0 16px; font-size: 15px; color: #334155;\">${escapeHtml(replyInstruction)}</p>`,
          `<p style=\"margin: 0; font-size: 15px; color: #334155;\">${escapeHtml(footerText)}</p>`,
        ].join(""),
    "</td>",
    "</tr>",
    "<tr>",
    "<td style=\"padding: 18px 0 0; color: #64748b; font-size: 12px; line-height: 1.5;\">",
    `This email was sent because a registration was submitted for ${escapeHtml(input.organizationName)}.`,
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");

  return {
    from,
    to,
    subject,
    text: lines.join("\n"),
    html,
    ...(replyTo ? { replyTo } : {}),
  };
}

export async function sendRegistrationConfirmationEmail(input: RegistrationConfirmationEmailInput) {
  const payload = buildEmail(input);
  return sendEmailPayload(payload);
}

export async function sendEventRegistrantEmail(input: EventRegistrantEmailInput) {
  const payload = buildEmail(input, {
    titleText: "Event update",
    subjectTemplate: "Update for {{eventName}}",
    messageTemplate: "Here is an update about {{eventName}}.",
    footerText: "Thanks.",
  });
  return sendEmailPayload(payload);
}

async function sendEmailPayload(payload: EmailPayload | null) {
  if (!payload) return { skipped: true };

  const transport = testTransport ?? {
    send: (email: EmailPayload) => {
      const resend = new Resend(process.env["RESEND_API_KEY"]);
      return resend.emails.send(email);
    },
  };

  await transport.send(payload);
  return { skipped: false };
}
