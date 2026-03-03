import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

interface NotifyBody {
  recipients: string[];
  subject: string;
  videoTitle: string;
  frameUrl: string;
  version: string;
  customMessage: string;
  postedBy: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NotifyBody;
    const {
      recipients,
      subject,
      videoTitle,
      frameUrl,
      version,
      customMessage,
      postedBy,
    } = body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required." },
        { status: 400 },
      );
    }

    if (!frameUrl || !videoTitle || !version) {
      return NextResponse.json(
        { error: "videoTitle, version, and frameUrl are required." },
        { status: 400 },
      );
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailAppPassword) {
      return NextResponse.json(
        {
          error:
            "Email is not configured yet. Set GMAIL_USER and GMAIL_APP_PASSWORD.",
        },
        { status: 400 },
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Link Ready for Review</h2>
        <p><strong>Video:</strong> ${videoTitle}</p>
        <p><strong>Version:</strong> ${version}</p>
        <p><strong>Posted by:</strong> ${postedBy}</p>
        <p><strong>Review Link:</strong> <a href="${frameUrl}">${frameUrl}</a></p>
        <p><strong>Message:</strong> ${customMessage || "Please review when available."}</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Production Review" <${gmailUser}>`,
      to: recipients.join(", "),
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown email failure.",
      },
      { status: 500 },
    );
  }
}
