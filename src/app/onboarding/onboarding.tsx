"use client";

import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type Profile, PROFILE_FIELDS, useProfileFields } from "@/app/app/profile/profile-form";
import { Button } from "@/components/ui/button";
import { type Allergen, type DietType, type Goal, GOALS, ONBOARDING_STEPS, TRACKING_MODES, type TrackingMode } from "@/lib/enums";
import { nextStep, previousStep } from "./actions";

type Props = { step: number; profile: Profile; coach: { name: string; welcome: string }; inviteMode: string | null };

// One step at a time in one form: Next saves the step's answers (or, on the last step, finishes), Back goes back without saving.
// The profile's own fields and section panels, so onboarding asks exactly what the profile page edits.
export function Onboarding({ step, profile, coach, inviteMode }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const [refused, next] = useActionState(nextStep, null);
  const f = useProfileFields(profile, refused);
  const values: Record<string, unknown> = refused?.values ?? profile;
  const key = ONBOARDING_STEPS[step];
  const invalid = (name: string) => Boolean(refused?.invalid.includes(name));
  const kg = (value: number | null) => value && format.number(value, { maximumFractionDigits: 1 }); // the label carries "(kg)"

  return (
    // The long "about" step takes the width for two columns; the others keep a reading measure.
    <div className={cn("flex w-full flex-col gap-8", key === "about" ? "max-w-6xl" : "max-w-3xl")}>
      <ol aria-label={t("Onboarding.progress")} className="grid grid-cols-4 gap-2 sm:gap-3">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="flex flex-col gap-2 text-xs text-muted-foreground aria-[current=step]:font-medium aria-[current=step]:text-primary-ink sm:text-sm">
            <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-primary-track")} aria-hidden />
            {t(`Onboarding.steps.${s}`)}
          </li>
        ))}
      </ol>

      <form action={next} className="flex flex-col gap-6">
        <input type="hidden" name="step" value={step} />

        {key === "welcome" && (
          <>
            <Title title={t("Onboarding.welcome.title", { coach: coach.name })} lead={t("Onboarding.welcome.lead")} />
            {/* The coach's own words, as they wrote them. */}
            <figure className="rounded-lg border bg-card p-6">
              <blockquote className="text-base whitespace-pre-line">{coach.welcome}</blockquote>
              <figcaption className="mt-4 text-sm font-medium">{coach.name}</figcaption>
            </figure>
            <Panel id="onboarding-next" title={t("Onboarding.welcome.nextTitle")}>
              <dl className="grid gap-4 sm:grid-cols-3">
                {(["about", "goal", "done"] as const).map((s) => (
                  <div key={s}>
                    <dt className="text-sm font-medium">{t(`Onboarding.steps.${s}`)}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground">{t(`Onboarding.welcome.next.${s}`, { coach: coach.name })}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </>
        )}

        {key === "about" && (
          <>
            <Title title={t("Onboarding.about.title")} lead={t("Onboarding.about.lead")} />
            {/* The profile page's arrangement: two stacked columns on wide screens, the spec's order in one column below. */}
            <div className="grid items-start gap-6 xl:grid-cols-2">
              {[["personal", "dietary"] as const, ["training", "preferences", "additional"] as const].map((column) => (
                <div key={column[0]} className="flex flex-col gap-6">
                  {column.map((section) => (
                    <Panel key={section} id={`onboarding-${section}`} title={t(`Profile.sections.${section}.title`)} text={t(`Profile.sections.${section}.text`)}>
                      <div className="grid gap-4 sm:grid-cols-2">{PROFILE_FIELDS[section](f)}</div>
                    </Panel>
                  ))}
                </div>
              ))}
            </div>
            <Panel
              id="onboarding-tracking"
              title={t("Onboarding.tracking.title")}
              text={inviteMode ? t("Onboarding.tracking.set", { mode: t(`TrackingModes.${inviteMode as TrackingMode}`) }) : t("Onboarding.tracking.text")}
            >
              <Choices name="preferredTrackingMode" labelledBy="onboarding-tracking" invalid={invalid("preferredTrackingMode")}>
                {TRACKING_MODES.map((m) => (
                  <Choice key={m} name="preferredTrackingMode" value={m} checked={values.preferredTrackingMode === m} label={t(`TrackingModes.${m}`)}>
                    {t(`Onboarding.tracking.modes.${m}`)}
                  </Choice>
                ))}
              </Choices>
            </Panel>
          </>
        )}

        {key === "goal" && (
          <>
            <Title title={t("Onboarding.goal.title")} lead={t("Onboarding.goal.lead")} />
            <Panel id="onboarding-goal" title={t("Profile.fields.primaryGoal")}>
              <Choices name="primaryGoal" labelledBy="onboarding-goal" invalid={invalid("primaryGoal")}>
                {GOALS.map((g) => (
                  <Choice key={g} name="primaryGoal" value={g} checked={values.primaryGoal === g} label={t(`Goals.${g}`)} required />
                ))}
              </Choices>
            </Panel>
            <Panel id="onboarding-target" title={t("Onboarding.goal.targetTitle")} text={t("Onboarding.goal.targetText")}>
              <div className="grid gap-4 sm:grid-cols-2">
                {f.input("targetWeightKg", { type: "number", min: 30, max: 300, step: 0.1 })}
                {f.input("targetDate", { type: "date" })}
                {f.area("successText", 1000)}
              </div>
            </Panel>
          </>
        )}

        {key === "done" && (
          <>
            <Title title={t("Onboarding.done.title")} lead={t("Onboarding.done.lead", { coach: coach.name })} />
            {/* What the coach starts from, as saved, to check before finishing. */}
            <Panel id="onboarding-summary" title={t("Onboarding.done.summary")}>
              <dl className="divide-y divide-rule text-sm">
                {[
                  [t("Profile.fields.primaryGoal"), profile.primaryGoal && t(`Goals.${profile.primaryGoal as Goal}`)],
                  [t("Profile.fields.weightKg"), kg(profile.weightKg)],
                  [t("Profile.fields.targetWeightKg"), kg(profile.targetWeightKg)],
                  [t("Profile.fields.targetDate"), profile.targetDate && format.dateTime(new Date(profile.targetDate), { dateStyle: "long", timeZone: "UTC" })],
                  [t("Profile.fields.dietType"), profile.dietType && t(`DietTypes.${profile.dietType as DietType}`)],
                  [t("Profile.fields.allergens"), (profile.allergens as Allergen[]).map((a) => t(`Allergens.${a}`)).join(", ")],
                  [t("Profile.fields.sports"), profile.sports],
                  [t("Profile.fields.mealsPerDay"), profile.mealsPerDay && format.number(profile.mealsPerDay)],
                  [t("Onboarding.done.tracking"), profile.preferredTrackingMode && t(`TrackingModes.${profile.preferredTrackingMode as TrackingMode}`)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className={cn("text-right font-medium tabular-nums", !value && "font-normal text-muted-foreground")}>{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </>
        )}

        <Actions step={step} />
      </form>
    </div>
  );
}

function Title({ title, lead }: { title: string; lead: string }) {
  return (
    <header>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
    </header>
  );
}

function Panel({ id, title, text, children }: { id: string; title: string; text?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card p-6">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Choices({ name, labelledBy, invalid, children }: { name: string; labelledBy: string; invalid: boolean; children: ReactNode }) {
  const t = useTranslations("Profile");
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid} aria-describedby={invalid ? `${name}-note` : undefined}>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
      {invalid && (
        <p id={`${name}-note`} className="mt-3 text-xs text-destructive-ink">
          {t("invalid")}
        </p>
      )}
    </div>
  );
}

// A radio as a whole tappable option; the picked one takes the pale tint and the hue's edge.
function Choice({ name, value, checked, label, required, children }: { name: string; value: string; checked: boolean; label: string; required?: boolean; children?: ReactNode }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-md border p-4 transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      <input type="radio" name={name} value={value} defaultChecked={checked} required={required} className="mt-0.5 size-4 flex-none accent-primary outline-none" />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium">{label}</span>
        {children && <span className="text-sm text-muted-foreground">{children}</span>}
      </span>
    </label>
  );
}

// Back (not on the first step) on the left, Next / finish on the right; both wait while a step is being sent.
function Actions({ step }: { step: number }) {
  const t = useTranslations("Onboarding");
  const { pending } = useFormStatus();
  const last = step === ONBOARDING_STEPS.length - 1;
  return (
    <div className="flex items-center justify-between gap-3">
      {step > 0 ? (
        <Button type="submit" formAction={previousStep} formNoValidate variant="outline" disabled={pending} className="h-10 px-4">
          {t("back")}
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" disabled={pending} className="h-10 px-5">
        {last ? t("finish") : t("next")}
      </Button>
    </div>
  );
}
