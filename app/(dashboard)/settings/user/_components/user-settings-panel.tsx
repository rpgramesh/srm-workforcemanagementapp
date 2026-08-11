"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ServerActor } from "@/lib/server-session";
import type { User } from "@/types/user";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, SwitchField } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  updateMyProfile,
  changePin,
  updatePreferences,
  type ProfileUpdateInput,
  type PinChangeInput,
} from "@/features/users/actions/settings-actions";
import { roleLabel } from "@/lib/user-labels";

const AVATAR_COLORS = [
  "#10B981",
  "#06B6D4",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#3B82F6",
  "#14B8A6",
];

const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Asia/Singapore",
  "UTC",
];

const LANGUAGES = [
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
];

const THEMES = [
  { value: "dark", label: "Dark Teal" },
  { value: "light", label: "Light" },
  { value: "emerald", label: "Emerald" },
  { value: "midnight", label: "Midnight" },
];

interface UserSettingsPanelProps {
  actor: ServerActor;
  profile: User | null;
}

export function UserSettingsPanel({ actor, profile }: UserSettingsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [mobile, setMobile] = useState(profile?.mobile ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [color, setColor] = useState(profile?.color ?? AVATAR_COLORS[0]);
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "");

  const [theme, setTheme] = useState("dark");
  const [compactMode, setCompactMode] = useState(false);
  const [timezone, setTimezone] = useState(TIMEZONES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0].value);

  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [allowMessagesFrom, setAllowMessagesFrom] = useState<"everyone" | "managers" | "none">("everyone");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinErrors, setPinErrors] = useState<Record<string, string[]>>({});

  const sanitizePin = (raw: string): string => raw.replace(/\D/g, "").slice(0, 4);

  const handleSaveProfile = () => {
    startTransition(async () => {
      const payload: ProfileUpdateInput = {
        firstName,
        lastName,
        mobile,
        email: email || null,
        color: color || null,
        jobTitle: jobTitle || null,
      };
      const result = await updateMyProfile(payload);
      if (result.success) {
        toast.success("Profile saved", { description: result.message });
      } else {
        toast.error("Could not save profile", { description: result.message });
      }
    });
  };

  const handleSavePreferences = () => {
    startTransition(async () => {
      const result = await updatePreferences({
        theme,
        compactMode,
        timezone,
        language,
        showOnlineStatus,
        allowMessagesFrom,
      });
      if (result.success) {
        toast.success("Preferences saved", { description: result.message });
      } else {
        toast.error("Could not save preferences", { description: result.message });
      }
    });
  };

  const handleChangePin = () => {
    startTransition(async () => {
      setPinErrors({});
      const payload: PinChangeInput = {
        currentPin: sanitizePin(currentPin),
        newPin: sanitizePin(newPin),
        confirmPin: sanitizePin(confirmPin),
      };
      const result = await changePin(payload);
      if (result.success) {
        toast.success("PIN changed", { description: result.message });
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      } else {
        setPinErrors(result.issues ?? {});
        toast.error("Could not change PIN", { description: result.message });
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar firstName={firstName} lastName={lastName} size="lg" accent={color} />
          <div className="flex-1">
            <CardTitle className="text-lg">{firstName} {lastName}</CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="emerald" size="sm">{roleLabel(actor.role)}</Badge>
              <span className="text-xs text-slate-400">{actor.userId.slice(0, 8)}…</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <p className="mt-1 text-xs text-slate-400">Personal details and account information</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="firstName" label="First Name">
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field id="lastName" label="Last Name">
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
            <Field id="mobile" label="Mobile Number" hint="Australian format e.g. 0412 345 678">
              <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </Field>
            <Field id="email" label="Email Address">
              <Input id="email" type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </Field>
            <Field id="jobTitle" label="Job Title">
              <Input id="jobTitle" value={jobTitle ?? ""} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Waiter" />
            </Field>
            <Field id="color" label="Avatar Colour" hint="Used across roster and messaging">
              <div className="flex flex-wrap gap-2 pt-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition ${color === c ? "border-white scale-110" : "border-white/20 hover:border-white/50"}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleSaveProfile} disabled={isPending}>
              {isPending ? "Saving…" : "Save Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <p className="mt-1 text-xs text-slate-400">Personalise your dashboard experience</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="theme" label="Theme">
              <Select id="theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="timezone" label="Timezone">
              <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            </Field>
            <Field id="language" label="Language">
              <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="space-y-3">
            <SwitchField
              checked={compactMode}
              onChange={setCompactMode}
              label="Compact Mode"
              description="Denser layout with tighter spacing for more information density"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleSavePreferences} disabled={isPending}>
              {isPending ? "Saving…" : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <p className="mt-1 text-xs text-slate-400">Control visibility and communication preferences</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <SwitchField
              checked={showOnlineStatus}
              onChange={setShowOnlineStatus}
              label="Show Online Status"
              description="Let managers and teammates see when you are active on the platform"
            />
          </div>
          <Field id="allowMessagesFrom" label="Allow Messages From" hint="Who can send you direct messages">
            <Select
              id="allowMessagesFrom"
              value={allowMessagesFrom}
              onChange={(e) => setAllowMessagesFrom(e.target.value as "everyone" | "managers" | "none")}
            >
              <option value="everyone">Everyone on the team</option>
              <option value="managers">Only managers and admins</option>
              <option value="none">Nobody (offline)</option>
            </Select>
          </Field>
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleSavePreferences} disabled={isPending}>
              {isPending ? "Saving…" : "Save Privacy"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <p className="mt-1 text-xs text-slate-400">Update your 4-digit access PIN for clock-in and sign-in</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="currentPin" label="Current PIN" error={pinErrors.currentPin?.[0]}>
              <Input
                id="currentPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(sanitizePin(e.target.value))}
                placeholder="••••"
              />
            </Field>
            <Field id="newPin" label="New 4-Digit PIN" error={pinErrors.newPin?.[0]} hint="Must be different from current">
              <Input
                id="newPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(sanitizePin(e.target.value))}
                placeholder="••••"
              />
            </Field>
            <Field id="confirmPin" label="Confirm New PIN" error={pinErrors.confirmPin?.[0]}>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(sanitizePin(e.target.value))}
                placeholder="••••"
              />
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              PIN change will be recorded in the audit log for security compliance
            </p>
            <Button variant="primary" onClick={handleChangePin} disabled={isPending}>
              {isPending ? "Updating…" : "Change PIN"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
