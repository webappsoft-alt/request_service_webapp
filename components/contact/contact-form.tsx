"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const subjects = [
  "General question",
  "Find a professional",
  "Provider support",
  "Billing or pricing",
  "Partnerships",
  "Technical support",
];

export function ContactForm() {
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast.success("Message captured as a demo submission. Email delivery will be connected later.");
  }

  return (
    <form id="contact-form" onSubmit={onSubmit} className="flex flex-col gap-5">
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
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-subject">Subject</FieldLabel>
          <NativeSelect
            id="contact-subject"
            name="subject"
            required
            className="w-full"
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
          />
        </Field>
      </FieldGroup>
      <Button type="submit" size="xl" className="w-fit">
        Send message
      </Button>
    </form>
  );
}
