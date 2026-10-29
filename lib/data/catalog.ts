import type { CatalogEntry } from "../types";

/**
 * OAuth apps queued for research. Composio status comes from Composio’s
 * managed-auth list (docs.composio.dev/toolkits/managed-auth.md, re-checked 28 Oct 2026).
 */
const entry = (name: string, domain: string, composio: CatalogEntry["composio"], slug?: string): CatalogEntry => ({
  slug: slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  domain,
  composio,
});

export const CATALOG: CatalogEntry[] = [
  entry("GitHub", "github.com", "managed"),
  // Separate guides: Gmail's scopes are restricted (security assessment), Calendar's are
  // sensitive (verification only), and Drive's drive.file scope needs no review.
  entry("Gmail", "gmail.com", "managed"),
  entry("Google Calendar", "calendar.google.com", "managed"),
  entry("Google Drive", "drive.google.com", "managed"),
  entry("Slack", "slack.com", "managed"),
  entry("Xero", "xero.com", "byo"),
  entry("DocuSign", "docusign.com", "byo"),
  entry("Spotify", "spotify.com", "byo"),
  entry("Notion", "notion.so", "managed"),
  entry("Stripe", "stripe.com", "managed"),
  entry("HubSpot", "hubspot.com", "managed"),
  entry("Salesforce", "salesforce.com", "managed"),
  entry("Jira", "atlassian.com", "managed"),
  entry("Confluence", "atlassian.com", "managed"),
  entry("Zoom", "zoom.us", "managed"),
  entry("Asana", "asana.com", "managed"),
  entry("Dropbox", "dropbox.com", "managed"),
  entry("Airtable", "airtable.com", "managed"),
  entry("Trello", "trello.com", "managed"),
  entry("Linear", "linear.app", "managed"),
  entry("Figma", "figma.com", "managed"),
  entry("Zendesk", "zendesk.com", "managed"),
  entry("Discord", "discord.com", "managed"),
  entry("Microsoft Outlook", "outlook.com", "managed", "outlook"),
  entry("Microsoft Teams", "microsoft.com", "managed", "microsoft-teams"),
  entry("Intercom", "intercom.com", "managed"),
  entry("Mailchimp", "mailchimp.com", "managed"),
  entry("YouTube", "youtube.com", "managed"),
  entry("Todoist", "todoist.com", "managed"),
  entry("Sentry", "sentry.io", "managed"),
  entry("Shopify", "shopify.com", "byo"),
  entry("Snowflake", "snowflake.com", "byo"),
  entry("Vercel", "vercel.com", "byo"),
  entry("Pipedrive", "pipedrive.com", "byo"),
  entry("Klaviyo", "klaviyo.com", "byo"),
  entry("Datadog", "datadoghq.com", "byo"),
  entry("PayPal", "paypal.com", "byo"),
  entry("Webflow", "webflow.com", "byo"),
  entry("Workday", "workday.com", "byo"),
  entry("ServiceNow", "servicenow.com", "byo"),
  entry("Smartsheet", "smartsheet.com", "byo"),
  entry("LinkedIn", "linkedin.com", "managed"),
  entry("Calendly", "calendly.com", "managed"),
  entry("QuickBooks", "intuit.com", "managed"),
];

/** Nicknames and old names people search for. */
export const ALIASES: Record<string, string> = {
  gcal: "google-calendar",
  gdrive: "google-drive",
  "google-mail": "gmail",
};
