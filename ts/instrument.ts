import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  integrations: [Sentry.captureConsoleIntegration({ levels: ['warn','error'] })],
});