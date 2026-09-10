"use client";

import {
  useMemo,
  type InputHTMLAttributes,
} from "react";
import PhoneInputLib, { type CountryData } from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

import { cn } from "@/lib/utils";

type AuthPhoneInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

/** Longer dial codes first so e.g. 1242 wins over 1. */
const DIAL_CODE_TO_ISO: Array<[string, string]> = [
  ["1868", "tt"],
  ["1869", "kn"],
  ["1876", "jm"],
  ["1242", "bs"],
  ["1246", "bb"],
  ["1284", "vg"],
  ["1340", "vi"],
  ["1441", "bm"],
  ["1671", "gu"],
  ["1684", "as"],
  ["1784", "vc"],
  ["1809", "do"],
  ["1829", "do"],
  ["1849", "do"],
  ["998", "uz"],
  ["996", "kg"],
  ["995", "ge"],
  ["994", "az"],
  ["993", "tm"],
  ["992", "tj"],
  ["977", "np"],
  ["976", "mn"],
  ["975", "bt"],
  ["974", "qa"],
  ["973", "bh"],
  ["972", "il"],
  ["971", "ae"],
  ["970", "ps"],
  ["968", "om"],
  ["967", "ye"],
  ["966", "sa"],
  ["965", "kw"],
  ["964", "iq"],
  ["963", "sy"],
  ["962", "jo"],
  ["961", "lb"],
  ["960", "mv"],
  ["886", "tw"],
  ["880", "bd"],
  ["856", "la"],
  ["855", "kh"],
  ["853", "mo"],
  ["852", "hk"],
  ["850", "kp"],
  ["692", "mh"],
  ["691", "fm"],
  ["690", "tk"],
  ["689", "pf"],
  ["688", "tv"],
  ["687", "nc"],
  ["686", "ki"],
  ["685", "ws"],
  ["683", "nu"],
  ["682", "ck"],
  ["681", "wf"],
  ["680", "pw"],
  ["679", "fj"],
  ["678", "vu"],
  ["677", "sb"],
  ["676", "to"],
  ["675", "pg"],
  ["674", "nr"],
  ["673", "bn"],
  ["672", "nf"],
  ["670", "tl"],
  ["599", "cw"],
  ["598", "uy"],
  ["597", "sr"],
  ["595", "py"],
  ["594", "gf"],
  ["593", "ec"],
  ["592", "gy"],
  ["591", "bo"],
  ["590", "gp"],
  ["509", "ht"],
  ["508", "pm"],
  ["507", "pa"],
  ["506", "cr"],
  ["505", "ni"],
  ["504", "hn"],
  ["503", "sv"],
  ["502", "gt"],
  ["501", "bz"],
  ["423", "li"],
  ["421", "sk"],
  ["420", "cz"],
  ["389", "mk"],
  ["387", "ba"],
  ["386", "si"],
  ["385", "hr"],
  ["383", "xk"],
  ["382", "me"],
  ["381", "rs"],
  ["380", "ua"],
  ["378", "sm"],
  ["377", "mc"],
  ["376", "ad"],
  ["375", "by"],
  ["374", "am"],
  ["373", "md"],
  ["372", "ee"],
  ["371", "lv"],
  ["370", "lt"],
  ["359", "bg"],
  ["358", "fi"],
  ["357", "cy"],
  ["356", "mt"],
  ["355", "al"],
  ["354", "is"],
  ["353", "ie"],
  ["352", "lu"],
  ["351", "pt"],
  ["350", "gi"],
  ["299", "gl"],
  ["298", "fo"],
  ["297", "aw"],
  ["291", "er"],
  ["290", "sh"],
  ["269", "km"],
  ["268", "sz"],
  ["267", "bw"],
  ["266", "ls"],
  ["265", "mw"],
  ["264", "na"],
  ["263", "zw"],
  ["262", "re"],
  ["261", "mg"],
  ["260", "zm"],
  ["258", "mz"],
  ["257", "bi"],
  ["256", "ug"],
  ["255", "tz"],
  ["254", "ke"],
  ["253", "dj"],
  ["252", "so"],
  ["251", "et"],
  ["250", "rw"],
  ["249", "sd"],
  ["248", "sc"],
  ["246", "io"],
  ["245", "gw"],
  ["244", "ao"],
  ["243", "cd"],
  ["242", "cg"],
  ["241", "ga"],
  ["240", "gq"],
  ["239", "st"],
  ["238", "cv"],
  ["237", "cm"],
  ["236", "cf"],
  ["235", "td"],
  ["234", "ng"],
  ["233", "gh"],
  ["232", "sl"],
  ["231", "lr"],
  ["230", "mu"],
  ["229", "bj"],
  ["228", "tg"],
  ["227", "ne"],
  ["226", "bf"],
  ["225", "ci"],
  ["224", "gn"],
  ["223", "ml"],
  ["222", "mr"],
  ["221", "sn"],
  ["220", "gm"],
  ["218", "ly"],
  ["216", "tn"],
  ["213", "dz"],
  ["212", "ma"],
  ["211", "ss"],
  ["98", "ir"],
  ["95", "mm"],
  ["94", "lk"],
  ["93", "af"],
  ["92", "pk"],
  ["91", "in"],
  ["90", "tr"],
  ["86", "cn"],
  ["84", "vn"],
  ["82", "kr"],
  ["81", "jp"],
  ["66", "th"],
  ["65", "sg"],
  ["64", "nz"],
  ["63", "ph"],
  ["62", "id"],
  ["61", "au"],
  ["60", "my"],
  ["58", "ve"],
  ["57", "co"],
  ["56", "cl"],
  ["55", "br"],
  ["54", "ar"],
  ["53", "cu"],
  ["52", "mx"],
  ["51", "pe"],
  ["49", "de"],
  ["48", "pl"],
  ["47", "no"],
  ["46", "se"],
  ["45", "dk"],
  ["44", "gb"],
  ["43", "at"],
  ["41", "ch"],
  ["40", "ro"],
  ["39", "it"],
  ["36", "hu"],
  ["34", "es"],
  ["33", "fr"],
  ["32", "be"],
  ["31", "nl"],
  ["30", "gr"],
  ["27", "za"],
  ["20", "eg"],
  ["7", "ru"],
  ["1", "us"],
];

function toDigits(value: string) {
  return String(value || "")
    .replace(/^\+/, "")
    .replace(/\D/g, "");
}

/** Default USA when empty; otherwise match dial code on the number. */
function countryFromDigits(digits: string): string {
  if (!digits) return "us";
  for (const [dial, iso] of DIAL_CODE_TO_ISO) {
    if (digits.startsWith(dial)) return iso;
  }
  return "us";
}

function isCountryData(data: CountryData | Record<string, never>): data is CountryData {
  return Boolean(
    data &&
      typeof data === "object" &&
      "countryCode" in data &&
      typeof (data as CountryData).countryCode === "string" &&
      (data as CountryData).countryCode,
  );
}

/**
 * Reusable phone field (react-phone-input-2) for Customer + Pro auth and profile.
 * - Empty number → USA flag by default
 * - Existing number → flag matches dial code (e.g. +92 → Pakistan)
 * - Manual country pick updates the flag
 */
export function AuthPhoneInput({
  id,
  value,
  onChange,
  placeholder = "Enter phone number",
  disabled,
  required,
  className,
  inputProps,
}: AuthPhoneInputProps) {
  const digits = useMemo(() => toDigits(value), [value]);
  const country = countryFromDigits(digits);
  // Remount when empty ↔ has-number so country + value apply together
  // (updating `country` alone makes the lib emit dial-only and wipe the number).
  const instanceKey = `${country}-${digits ? "set" : "empty"}`;

  return (
    <div className={cn("rs-phone-input", className)}>
      <PhoneInputLib
        key={instanceKey}
        country={country}
        preferredCountries={["us", "pk", "ca", "gb", "au", "in", "ae"]}
        value={digits}
        onChange={(next, data) => {
          const cleaned = String(next || "").replace(/\D/g, "");

          // Ignore spurious wipe when country sync emits only the dial code.
          if (
            isCountryData(data) &&
            digits.length > 4 &&
            cleaned.length <= 4 &&
            digits.startsWith(cleaned)
          ) {
            return;
          }

          onChange(cleaned ? `+${cleaned}` : "");
        }}
        disabled={disabled}
        enableSearch
        disableSearchIcon
        countryCodeEditable={false}
        placeholder={placeholder}
        specialLabel=""
        inputProps={{
          id,
          name: inputProps?.name || "phone",
          required,
          autoComplete: "tel",
          ...inputProps,
        }}
        containerClass="rs-phone-container"
        inputClass="rs-phone-field"
        buttonClass="rs-phone-button"
        dropdownClass="rs-phone-dropdown"
        searchClass="rs-phone-search"
      />
    </div>
  );
}
