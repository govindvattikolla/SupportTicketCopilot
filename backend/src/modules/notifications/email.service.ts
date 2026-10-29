export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  deduplicationKey?: string;
}

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
  text?: string;
  deduplicationKey?: string;
  sentAt: Date;
}

class EmailService {
  private sentEmails: SentEmailRecord[] = [];
  private deduplicationSet: Set<string> = new Set();

  /**
   * Dispatches an email with idempotency and deduplication checking.
   * If a deduplicationKey has already been processed, the duplicate send is skipped.
   */
  async sendEmail(options: SendEmailOptions): Promise<{ sent: boolean; messageId: string; duplicate?: boolean }> {
    const { to, subject, html, text, deduplicationKey } = options;

    if (deduplicationKey) {
      if (this.deduplicationSet.has(deduplicationKey)) {
        return {
          sent: false,
          duplicate: true,
          messageId: `duplicate-${deduplicationKey}`,
        };
      }
      this.deduplicationSet.add(deduplicationKey);
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const record: SentEmailRecord = {
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      deduplicationKey,
      sentAt: new Date(),
    };

    this.sentEmails.push(record);

    // If in development/testing, log delivery cleanly
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[EmailService] ✉️ Email dispatched to: ${to} | Subject: "${subject}" [ID: ${messageId}]`);
    }

    return {
      sent: true,
      messageId,
    };
  }

  /**
   * Helper for tests: retrieves all sent emails
   */
  getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  /**
   * Helper for tests: clears in-memory email store
   */
  clear(): void {
    this.sentEmails = [];
    this.deduplicationSet.clear();
  }
}

export const emailService = new EmailService();
