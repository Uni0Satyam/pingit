import mongoose, { model, Schema } from "mongoose";

interface IBillingWebhookEvent {
  eventId: string;
  eventType: string;
  paymentId?: string;
  processedAt: Date;
}

const billingWebhookEventSchema = new Schema<IBillingWebhookEvent>({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  paymentId: { type: String },
  processedAt: { type: Date, required: true, default: Date.now },
});

billingWebhookEventSchema.index(
  { paymentId: 1 },
  { unique: true, sparse: true },
);
billingWebhookEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
);

const BillingWebhookEvent =
  mongoose.models.BillingWebhookEvent ||
  model<IBillingWebhookEvent>("BillingWebhookEvent", billingWebhookEventSchema);

export default BillingWebhookEvent;
