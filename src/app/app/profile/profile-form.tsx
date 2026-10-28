"use client";

import { useTranslations } from "next-intl";
import { type ComponentProps, type ReactNode, useActionState, useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/generated/prisma/client";
import { ALLERGENS, type Allergen, DIET_TYPES, GOALS, SEXES, SPORT_LEVELS } from "@/lib/enums";
import type { ProfileField, ProfileSection } from "@/lib/profile";
import { saveProfile } from "./actions";

export type Profile = Client & { name: string };
type Name = Exclude<ProfileField, "allergens">;

// The whole profile for the client (/app/profile) and their coach (/coach/clients/[id]/profile).
// Each section is a panel with its own Save. Wide screens set them in two stacked columns (no empty label column beside
// a tall panel, and most sections start on the first screen); narrower ones keep the spec's order in one column.
export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations();
  const ticked = profile.allergens as Allergen[];
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Section section="personal" profile={profile}>
          {(f) => (
            <>
              {f.input("name", { required: true, maxLength: 100, className: "sm:col-span-2" })}
              {f.select("sex", SEXES, "Sexes")}
              {f.input("birthDate", { type: "date" })}
              {f.input("heightCm", { type: "number", min: 100, max: 250, step: 1 })}
              {f.input("weightKg", { type: "number", min: 30, max: 300, step: 0.1 })}
              {f.input("phone", { type: "tel", maxLength: 20, pattern: "\\+?[\\d ()\\-]{6,20}" })}
            </>
          )}
        </Section>
        <Section section="goals" profile={profile}>
          {(f) => (
            <>
              {f.select("primaryGoal", GOALS, "Goals", "sm:col-span-2")}
              {f.input("targetWeightKg", { type: "number", min: 30, max: 300, step: 0.1 })}
              {f.input("targetDate", { type: "date" })}
              {f.area("successText", 1000)}
            </>
          )}
        </Section>
        <Section section="preferences" profile={profile}>
          {(f) => (
            <>
              {f.area("likedFoods", 1000)}
              {f.area("dislikedFoods", 1000)}
              {f.input("mealsPerDay", { type: "number", min: 1, max: 10, step: 1 })}
            </>
          )}
        </Section>
      </div>
      <div className="flex flex-col gap-6">
        <Section section="dietary" profile={profile}>
          {(f) => (
            <>
              {f.select("dietType", DIET_TYPES, "DietTypes", "sm:col-span-2")}
              <fieldset className="sm:col-span-2">
                <legend className="mb-3 text-sm font-medium">{t("Profile.fields.allergens")}</legend>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {ALLERGENS.map((a) => (
                    <label key={a} className="flex min-h-8 items-center gap-2 text-sm">
                      <input type="checkbox" name="allergens" value={a} defaultChecked={ticked.includes(a)} className="size-4 flex-none accent-primary" />
                      {t(`Allergens.${a}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              {f.input("allergiesNote", { maxLength: 500, className: "sm:col-span-2" })}
              {f.area("restrictions", 1000)}
            </>
          )}
        </Section>
        <Section section="training" profile={profile}>
          {(f) => (
            <>
              {f.input("sports", { maxLength: 200 })}
              {f.select("sportLevel", SPORT_LEVELS, "SportLevels")}
              {f.input("sessionsPerWeek", { type: "number", min: 0, max: 21, step: 1 })}
              {f.input("sessionMinutes", { type: "number", min: 10, max: 600, step: 1 })}
            </>
          )}
        </Section>
        <Section section="additional" profile={profile}>
          {(f) => (
            <>
              {f.area("healthConditions", 1000, "")}
              {f.area("medications", 1000, "")}
              {f.area("otherInfo", 1000)}
            </>
          )}
        </Section>
      </div>
    </div>
  );
}

type Fields = {
  input: (name: Name, props?: ComponentProps<typeof Input>) => ReactNode;
  select: (name: Name, options: readonly string[], labels: "Sexes" | "Goals" | "DietTypes" | "SportLevels", className?: string) => ReactNode;
  area: (name: Name, maxLength: number, className?: string) => ReactNode;
};

function Section({ section, profile, children }: { section: ProfileSection; profile: Profile; children: (f: Fields) => ReactNode }) {
  const t = useTranslations();
  const [state, save, pending] = useActionState(saveProfile, null);
  const [edited, setEdited] = useState(false); // "Saved" shows until the next change
  const invalid = (name: string) => Boolean(state && "invalid" in state && state.invalid.includes(name));

  // Each control: the label above, its saved value, and the error from the last save pointed at with aria-describedby.
  const field = (name: Name, control: (attrs: { id: string; name: string; defaultValue: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode, className?: string) => {
    const id = `profile-${name}`;
    const error = invalid(name) ? t("Profile.invalid") : undefined;
    const attrs = { id, name, defaultValue: String(profile[name] ?? ""), "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-note` : undefined };
    return (
      <Field key={name} id={id} label={t(`Profile.fields.${name}`)} error={error} className={className}>
        {control(attrs)}
      </Field>
    );
  };
  const f: Fields = {
    input: (name, { className, ...props } = {}) => field(name, (attrs) => <Input {...attrs} {...props} />, className),
    select: (name, options, labels, className) =>
      field(
        name,
        (attrs) => (
          <NativeSelect {...attrs} className="w-full">
            <NativeSelectOption value="">{t("Profile.notSet")}</NativeSelectOption>
            {options.map((o) => (
              <NativeSelectOption key={o} value={o}>
                {t(`${labels}.${o}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ),
        className,
      ),
    area: (name, maxLength, className = "sm:col-span-2") => field(name, (attrs) => <Textarea {...attrs} maxLength={maxLength} rows={2} />, className),
  };

  return (
    <section aria-labelledby={`profile-${section}`} className="rounded-lg border bg-card p-6">
      <h2 id={`profile-${section}`} className="text-base font-semibold">
        {t(`Profile.sections.${section}.title`)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t(`Profile.sections.${section}.text`)}</p>
      <form
        action={(form) => {
          setEdited(false);
          save(form);
        }}
        onInput={() => setEdited(true)}
        className="mt-6 grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="clientId" value={profile.id} />
        <input type="hidden" name="section" value={section} />
        {children(f)}
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          <p role="status" className="text-sm text-muted-foreground">
            {state && "saved" in state && !edited && !pending && t("Profile.saved")}
          </p>
          {/* Six panels, six Saves: outlined, so the hue stays on the data (one filled primary per screen). */}
          <Button type="submit" variant="outline" disabled={pending} className="h-10 px-4 sm:h-8">
            {t("Profile.save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
