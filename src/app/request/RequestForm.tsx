"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createRequest, type RequestFormState } from "@/lib/actions/requests";
import { Field, TextInput, TextArea, Select, SegmentedRadios } from "@/components/FormField";
import { Button } from "@/components/Button";
import { COURSES, GRADES, STUDENT_EMAIL_DOMAIN } from "@/lib/constants";

const initialState: RequestFormState = { errors: {}, values: {} };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send request"}
    </Button>
  );
}

export function RequestForm() {
  const [state, formAction] = useActionState(createRequest, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {/* Honeypot — hidden from real users, catches naive bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <Field label="Your name" htmlFor="studentName" error={state.errors.studentName}>
        <TextInput
          id="studentName"
          name="studentName"
          placeholder="First and last name"
          defaultValue={state.values.studentName}
          autoComplete="name"
          required
        />
      </Field>

      <Field
        label="School email"
        htmlFor="studentEmail"
        error={state.errors.studentEmail}
        hint={`Must be your @${STUDENT_EMAIL_DOMAIN} address.`}
      >
        <TextInput
          id="studentEmail"
          name="studentEmail"
          type="email"
          placeholder={`you@${STUDENT_EMAIL_DOMAIN}`}
          defaultValue={state.values.studentEmail}
          autoComplete="email"
          required
        />
      </Field>

      <Field label="Grade" htmlFor="gradeLevel" error={state.errors.gradeLevel}>
        <SegmentedRadios name="gradeLevel" options={GRADES} defaultValue={state.values.gradeLevel} />
      </Field>

      <Field label="Course" htmlFor="subject" error={state.errors.subject}>
        {/* key forces a remount on re-render so the submitted choice survives
            React 19's post-action form reset (defaultValue can't change after mount) */}
        <Select
          key={`subject-${state.values.subject ?? ""}`}
          id="subject"
          name="subject"
          defaultValue={state.values.subject ?? ""}
          required
        >
          <option value="" disabled>
            Choose your course
          </option>
          {COURSES.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="What do you need help with?"
        htmlFor="topic"
        error={state.errors.topic}
        hint="The unit, topic, or specific problems you're stuck on."
      >
        <TextArea
          id="topic"
          name="topic"
          rows={4}
          placeholder="e.g. Solving trig identities — I get lost after the first substitution…"
          defaultValue={state.values.topic}
          required
        />
      </Field>

      <Field
        label="When are you free?"
        htmlFor="availability"
        error={state.errors.availability}
        hint="Days, breaks, or after school — anything that helps find a time."
      >
        <TextArea
          id="availability"
          name="availability"
          rows={3}
          placeholder="e.g. Lunch on Tuesdays and Thursdays, or after school Wednesday"
          defaultValue={state.values.availability}
          required
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
