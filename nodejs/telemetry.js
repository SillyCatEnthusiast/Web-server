// src/telemetry.js
'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');

// ---- HARD opt-out switch ----
// If TELEMETRY_ENABLED !== "true", do not start OTel at all.
if (process.env.TELEMETRY_ENABLED !== 'true') {
  console.log('[telemetry] disabled');
  module.exports = { shutdown: async () => {} };
  return;
}

const traceExporter = new OTLPTraceExporter({
  // Example: http://otel-collector:4318/v1/traces
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
});

const metricExporter = new OTLPMetricExporter({
  // Example: http://otel-collector:4318/v1/metrics
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
});

const sdk = new NodeSDK({
    resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'my-site',
    [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION || '0.1.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter,
  metricExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

async function shutdown() {
  try {
    await sdk.shutdown();
  } catch (e) {
    // don’t crash on shutdown issues
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { shutdown };
