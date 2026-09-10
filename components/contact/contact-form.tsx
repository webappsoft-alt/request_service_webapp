"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { submitContactUs } from "@/store/contactUsSlice";

const subjects = [
  "General question",
  "Find a professional",
  "Provider support",
  "Billing or pricing",
  "Partnerships",
  "Technical support",
];

export function ContactForm() {
  const dispatch = useAppDispatch();
  const submitting = useAppSelector((state) => state.contactUs.submitting);
  const [formKey, setFormKey] = useState(0);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const firstName = String(data.get("firstName") || "").trim();
    const lastName = String(data.get("lastName") || "").trim();
    const email = String(data.get("email") || "").trim();
    const subject = String(data.get("subject") || "").trim();
    const message = String(data.get("message") || "").trim();

    if (!firstName || !lastName || !email || !subject || !message) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      const result = await dispatch(
        submitContactUs({
          firstName,
          lastName,
          email,
          subject,
          message,
        }),
      ).unwrap();
      toast.success(result.message);
      setFormKey((key) => key + 1);
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : "Failed to send your message. Please try again.",
      );
    }
  }

  return (
    <form
      key={formKey}
      id="contact-form"
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
    >
      <FieldGroup className="gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="contact-first">First name</FieldLabel>
            <Input
              id="contact-first"
              name="firstName"
              autoComplete="given-name"
              placeholder="Enter your first name"
              required
              disabled={submitting}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-last">Last name</FieldLabel>
            <Input
              id="contact-last"
              name="lastName"
              autoComplete="family-name"
              placeholder="Enter your last name"
              required
              disabled={submitting}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="contact-email">Email address</FieldLabel>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            required
            disabled={submitting}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-subject">Subject</FieldLabel>
          <NativeSelect
            id="contact-subject"
            name="subject"
            required
            className="w-full"
            disabled={submitting}
          >
            <NativeSelectOption value="">Select a topic</NativeSelectOption>
            {subjects.map((subject) => (
              <NativeSelectOption key={subject} value={subject}>
                {subject}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-message">Message</FieldLabel>
          <Textarea
            id="contact-message"
            name="message"
            rows={6}
            placeholder="How can we help you?"
            required
            disabled={submitting}
          />
        </Field>
      </FieldGroup>
      <Button type="submit" size="xl" className="w-fit" disabled={submitting}>
        {submitting ? (
          <>
            <Spinner size="sm" label="Sending" />
            Sending…
          </>
        ) : (
          "Send message"
        )}
      </Button>
    </form>
  );
}
