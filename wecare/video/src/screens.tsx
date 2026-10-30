import {
  Activity,
  ArrowRight,
  Brain,
  Building2,
  Check,
  CircleCheck,
  ClipboardList,
  Clock,
  CloudUpload,
  Droplets,
  Gauge,
  HeartPulse,
  Inbox,
  Lock,
  Minus,
  Plus,
  QrCode,
  RotateCcw,
  ScanLine,
  Thermometer,
  UserRound,
  Waypoints,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Consciousness } from "../../src/domain/news2";
import type { Patient } from "../../src/domain/visit";
import { ACTION, ADA, BEN, CLINIC, news2, ROSTER, type VisitView, type Vitals } from "./data";
import { C, F, RISK, T } from "./theme";
import { Button, Card, col, Header, HeaderAction, Icon, IconTile, Pill, RiskPill, row, Screen, Section, StatusBar } from "./ui";

// Every screen here is dumb: state comes in as props (`show` values run 0 … 1).

const ADDRESS: Record<string, string> = { [ADA.name]: ADA.address, [BEN.name]: BEN.address, [CLINIC.name]: CLINIC.address };

// ---------------------------------------------------------------- welcome

const ROLES = [
  {
    role: "chw",
    icon: HeartPulse,
    title: "Health worker",
    body: "Visit households, record vitals and see an early-warning score on the spot.",
    placeholder: "Your name, for example Ada",
  },
  {
    role: "clinic",
    icon: Building2,
    title: "Clinic hub",
    body: "Enroll health workers, receive their visits without signal, and pass them to the EHR.",
    placeholder: "Clinic name, for example Riverside Clinic",
  },
] as const;

export const WelcomeScreen = ({ role, name, caret, pressed, scroll }: { role: "chw" | "clinic"; name: string; caret?: boolean; pressed?: boolean; scroll?: number }) => {
  const chosen = ROLES.find((r) => r.role === role)!;
  return (
    <Screen scroll={scroll} header={<Header title="WeCare" />}>
      <span style={{ ...T.body, color: C.muted }}>
        Home visits that reach the clinic with no signal. Phones pass sealed records to one another over Bluetooth until one arrives.
      </span>
      <Section title="This phone is for" />
      {ROLES.map((r) => {
        const on = r.role === role;
        return (
          <Card key={r.role} accent={on} style={{ ...row(14), padding: on ? 15 : 16 }}>
            <IconTile icon={r.icon} />
            <div style={{ flex: 1, ...col(2) }}>
              <span style={T.title}>{r.title}</span>
              <span style={T.small}>{r.body}</span>
            </div>
            <div style={{ width: 22, display: "flex", justifyContent: "center" }}>
              {on ? <Icon icon={CircleCheck} color={C.accent} size={20} /> : <div style={{ width: 18, height: 18, borderRadius: 9, border: `1.5px solid ${C.line}`, boxSizing: "border-box" }} />}
            </div>
          </Card>
        );
      })}
      <Section title="Name" />
      <div style={{ backgroundColor: C.surface, borderRadius: 6, border: `1px solid ${C.line}`, padding: "12px 14px", fontFamily: F.body, fontSize: 16, lineHeight: "22px" }}>
        {name ? <span style={{ color: C.ink }}>{name}</span> : null}
        {caret && <span style={{ display: "inline-block", width: 2, height: 20, backgroundColor: C.accent, verticalAlign: "middle", marginLeft: 1 }} />}
        {!name && <span style={{ color: C.faint }}>{chosen.placeholder}</span>}
      </div>
      <div style={{ height: 4 }} />
      <Button title="Start" icon={ArrowRight} disabled={!name} pressed={pressed} />
    </Screen>
  );
};

// ---------------------------------------------------------------- shared cards

const CELLS = (v: Vitals): [LucideIcon, string, string][] => [
  [Activity, "Breathing", `${v.respRate}/min`],
  [Droplets, "SpO₂", `${v.spo2}%${v.onOxygen ? " on O₂" : ""}`],
  [Gauge, "Systolic", `${v.systolic} mmHg`],
  [HeartPulse, "Pulse", `${v.pulse}/min`],
  [Thermometer, "Temp", `${v.tempC.toFixed(1)} °C`],
  [Brain, "Alertness", { A: "Alert", C: "Confused", V: "Voice", P: "Pain", U: "Unresponsive" }[v.consciousness]],
];

export const VisitCard = ({ v, footer }: { v: VisitView; footer: React.ReactNode }) => {
  const score = news2(v.vitals);
  return (
    <Card>
      <div style={row(10, { alignItems: "flex-start" })}>
        <div style={{ flex: 1, ...col() }}>
          <span style={T.title}>{v.patient.name}</span>
          <span style={T.small}>
            {v.patient.sex === "female" ? "Female" : "Male"}, {2026 - v.patient.birthYear} · {v.patient.household}
          </span>
        </div>
        <RiskPill risk={score.risk} total={score.total} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", rowGap: 10, backgroundColor: C.sunken, borderRadius: 6, padding: 12 }}>
        {CELLS(v.vitals).map(([icon, k, val]) => (
          <div key={k} style={{ width: "50%", ...row(8, { alignItems: "flex-start" }) }}>
            <Icon icon={icon} color={C.accent} size={16} />
            <div style={col()}>
              <span style={{ ...T.label, fontSize: 12 }}>{k}</span>
              <span style={{ ...T.body, fontFamily: F.medium }}>{val}</span>
            </div>
          </div>
        ))}
      </div>
      {footer}
    </Card>
  );
};

export const SyncedPill = ({ ehr }: { ehr: VisitView["ehr"] }) =>
  ehr === "pending" ? <Pill text="Not in EHR yet" icon={CloudUpload} /> : <Pill text={ehr === "added" ? "In EHR" : "In EHR, already there"} icon={CircleCheck} tone="success" />;

export const CarriedCard = ({ rows }: { rows: [from: string, to: string, at: string][] }) => (
  <Card>
    <div style={row(12)}>
      <IconTile icon={Waypoints} />
      <div style={{ flex: 1 }}>
        <span style={T.body}>
          <span style={{ fontFamily: F.strong }}>{rows.length}</span> sealed {rows.length === 1 ? "record" : "records"} passed along for others
        </span>
        <div style={row(5, { marginTop: 2 })}>
          <Icon icon={Lock} color={C.muted} size={14} />
          <span style={T.small}>Encrypted for their recipient. Unreadable here.</span>
        </div>
      </div>
    </div>
    {rows.map(([from, to, at]) => (
      <div key={from + to + at} style={row(6)}>
        <span style={T.mono}>{from}</span>
        <Icon icon={ArrowRight} color={C.faint} size={14} />
        <span style={{ ...T.mono, flex: 1 }}>{to}</span>
        <span style={T.mono}>{at}</span>
      </div>
    ))}
  </Card>
);

export const SyncCard = ({ pending, note }: { pending: number; note?: string }) => (
  <Card>
    <div style={row(12)}>
      <IconTile icon={CloudUpload} />
      <div style={{ flex: 1, ...col() }}>
        <span style={T.body}>{pending ? `${pending} ${pending === 1 ? "visit" : "visits"} waiting for the EHR` : "Everything is in the EHR"}</span>
        <span style={T.small}>Sends on its own once this phone is online. Copies the EHR already has are refused there.</span>
      </div>
    </div>
    {note && (
      <div style={row(6)}>
        <Icon icon={CircleCheck} color={C.success} size={16} />
        <span style={{ ...T.small, flex: 1, color: C.success }}>{note}</span>
      </div>
    )}
    <Button title="Send to EHR now" icon={CloudUpload} kind="soft" />
  </Card>
);

/** A card that drops into a list: its slot opens from 0 to `h` px while it fades in. */
export const Arrive = ({ show, h, children }: { show: number; h: number; children: React.ReactNode }) =>
  show >= 1 ? (
    <>{children}</>
  ) : (
    <div style={{ height: show * h, marginTop: -12 * (1 - show), opacity: show, translate: `0 ${(1 - show) * -24}px`, overflow: "visible" }}>{children}</div>
  );

// ---------------------------------------------------------------- health worker home

export type Sent = { v: VisitView; delivered: number };

export const WorkerHome = ({
  name,
  nearby,
  clinic,
  enrolled = 0,
  sent = [],
  carried = [],
  scroll,
  wifi,
}: {
  name: string;
  nearby: number;
  clinic: "none" | "waiting" | "enrolled";
  enrolled?: number;
  sent?: Sent[];
  carried?: [string, string, string][];
  scroll?: number;
  wifi?: number;
}) => (
  <Screen scroll={scroll} wifi={wifi} header={<Header title={name} nearby={nearby} right={<HeaderAction icon={RotateCcw} label="Reset" />} />}>
    <Card>
      <div style={row(12)}>
        <IconTile icon={Building2} />
        <div style={{ flex: 1, ...col(2) }}>
          <span style={T.title}>{clinic === "none" ? "No clinic yet" : CLINIC.name}</span>
          {clinic === "enrolled" ? (
            <div style={row(5, { opacity: enrolled, translate: `0 ${(1 - enrolled) * 6}px` })}>
              <Icon icon={CircleCheck} color={C.success} size={14} />
              <span style={{ ...T.small, color: C.success }}>Enrolled. Visits are sealed for this clinic alone.</span>
            </div>
          ) : (
            <span style={T.small}>
              {clinic === "waiting" ? "Waiting for the clinic to accept. Stay close to the clinic phone." : "Scan the clinic's code while you are close to its phone."}
            </span>
          )}
        </div>
      </div>
      {clinic !== "enrolled" && <Button title={clinic === "waiting" ? "Scan a different code" : "Scan clinic code"} icon={ScanLine} kind={clinic === "waiting" ? "soft" : "primary"} />}
    </Card>
    <Button title="New visit" icon={Plus} />
    <Section title="Today's visits" count={sent.length} />
    {sent.length === 0 && (
      <Card style={row(12)}>
        <IconTile icon={ClipboardList} color={C.muted} bg={C.sunken} />
        <span style={{ ...T.small, flex: 1 }}>Visits you record stay on this phone until the clinic confirms them.</span>
      </Card>
    )}
    {sent.map(({ v, delivered }) => (
      <VisitCard
        key={v.patient.id}
        v={v}
        footer={
          <div style={row(8, { justifyContent: "space-between", flexWrap: "wrap" })}>
            {delivered >= 1 ? (
              <Pill text="At the clinic" icon={CircleCheck} tone="success" style={{ scale: String(1 + 0.12 * Math.max(0, 1.5 - delivered)) }} />
            ) : (
              <Pill text="On this phone, finding a route" icon={Clock} />
            )}
            <SyncedPill ehr={v.ehr} />
          </div>
        }
      />
    ))}
    <Section title="Electronic health record" />
    <SyncCard pending={sent.filter((x) => x.v.ehr === "pending").length} />
    <Section title="Carried for others" />
    <CarriedCard rows={carried} />
  </Screen>
);

// ---------------------------------------------------------------- scanner

const QR_N = 25;
const qrBit = (x: number, y: number) => {
  const finder = (fx: number, fy: number) => {
    const dx = x - fx;
    const dy = y - fy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return undefined;
    const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    return ring !== 2;
  };
  const f = finder(0, 0) ?? finder(QR_N - 7, 0) ?? finder(0, QR_N - 7);
  if (f !== undefined) return f;
  return ((x * 7919 + y * 104729 + x * y * 31) % 11) % 2 === 0;
};

/** A QR code drawn from a fixed pattern, standing in for the clinic's invite. */
export const Qr = ({ size }: { size: number }) => {
  const cell = size / QR_N;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: QR_N * QR_N }, (_, i) => {
        const x = i % QR_N;
        const y = Math.floor(i / QR_N);
        return qrBit(x, y) ? <rect key={i} x={x * cell} y={y * cell} width={cell + 0.3} height={cell + 0.3} fill={C.ink} /> : null;
      })}
    </svg>
  );
};

export const ScannerScreen = ({ qr, flash }: { qr: number; flash: number }) => (
  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, #3C4650 0%, #161A1F 70%)" }}>
    {/* the clinic phone's screen, seen through the camera */}
    <div
      style={{
        position: "absolute",
        left: 195 - 120,
        top: 422 - 120,
        width: 240,
        height: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        translate: `${(1 - qr) * 90}px ${(1 - qr) * 60}px`,
        rotate: `${(1 - qr) * 8}deg`,
        filter: `blur(${(1 - qr) * 4}px)`,
        opacity: 0.35 + 0.65 * qr,
      }}
    >
      <div style={{ padding: 12, backgroundColor: "#FFFFFF", borderRadius: 8 }}>
        <Qr size={176} />
      </div>
    </div>
    <div style={{ position: "absolute", left: 195 - 120, top: 422 - 120, width: 240, height: 240, borderRadius: 12, border: "2px solid #FFFFFFD9", boxShadow: `0 0 ${flash * 40}px ${flash * 6}px #FFFFFF` }} />
    <div style={{ position: "absolute", left: 18, right: 18, top: 59 + 14 }}>
      <span style={{ ...T.screenTitle, color: "#FFFFFF" }}>Scan the clinic's code</span>
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 34 + 28,
        left: "50%",
        translate: "-50% 0",
        ...row(8),
        padding: "12px 22px",
        borderRadius: 6,
        backgroundColor: C.surface,
      }}
    >
      <Icon icon={X} color={C.ink} size={16} />
      <span style={{ ...T.body, fontFamily: F.medium }}>Cancel</span>
    </div>
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#FFFFFF", opacity: flash * 0.35 }} />
    <StatusBar light />
  </div>
);

// ---------------------------------------------------------------- new visit

const ROWS: { key: "respRate" | "spo2" | "systolic" | "pulse" | "tempC"; icon: LucideIcon; label: string; unit: string }[] = [
  { key: "respRate", icon: Activity, label: "Breathing", unit: "/min" },
  { key: "spo2", icon: Droplets, label: "SpO₂", unit: "%" },
  { key: "systolic", icon: Gauge, label: "Systolic BP", unit: "mmHg" },
  { key: "pulse", icon: HeartPulse, label: "Pulse", unit: "/min" },
  { key: "tempC", icon: Thermometer, label: "Temperature", unit: "°C" },
];

const ACVPU: { k: Consciousness; label: string }[] = [
  { k: "A", label: "Alert" },
  { k: "C", label: "New confusion" },
  { k: "V", label: "Responds to voice" },
  { k: "P", label: "Responds to pain" },
  { k: "U", label: "Unresponsive" },
];

const Step = ({ icon, pressed }: { icon: LucideIcon; pressed?: boolean }) => (
  <div style={{ width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: pressed ? C.line : C.sunken, flexShrink: 0 }}>
    <Icon icon={icon} color={C.accent} size={18} />
  </div>
);

/** The pinned NEWS2 banner. `shown` is the total on display (it counts), `bump` scales it. */
export const ScoreBanner = ({ v, shown, bump = 0 }: { v: Vitals; shown?: number; bump?: number }) => {
  const score = news2(v);
  const r = RISK[score.risk];
  return (
    <div style={{ margin: "0 18px 8px", borderRadius: 8, backgroundColor: r.bg, padding: "12px 16px", ...row(14) }}>
      <span style={{ fontFamily: F.title, fontSize: 46, lineHeight: "52px", color: r.fg, minWidth: 30, scale: String(1 + bump * 0.25), display: "inline-block" }}>
        {shown ?? score.total}
      </span>
      <div style={{ flex: 1, ...col() }}>
        <span style={{ ...T.title, color: r.fg }}>{ACTION[score.risk]}</span>
        <span style={{ ...T.small, color: r.fg }}>NEWS2, {r.label.toLowerCase()} risk. Scored on this phone, for adults.</span>
      </div>
    </div>
  );
};

export const VisitFormScreen = ({
  patient,
  v,
  shown,
  bump,
  scroll,
  pressed,
}: {
  patient?: Patient;
  v: Vitals;
  shown?: number;
  bump?: number;
  scroll?: number;
  /** Which control is held down: "respRate+", "spo2-", "save", … */
  pressed?: string;
}) => {
  const score = news2(v);
  return (
    <Screen
      scroll={scroll}
      header={
        <>
          <Header title="New visit" right={<HeaderAction icon={X} label="Cancel" />} />
          <ScoreBanner v={v} shown={shown} bump={bump} />
        </>
      }
    >
      <Section title="Patient" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ROSTER.map((p) => {
          const on = patient?.id === p.id;
          return (
            <div
              key={p.id}
              style={{
                borderRadius: 8,
                padding: on ? "9.5px 11.5px" : "10px 12px",
                backgroundColor: on ? C.accentSoft : C.surface,
                border: on ? `1.5px solid ${C.accent}` : `0.5px solid ${C.line}`,
                boxShadow: "0 3px 10px #3B6E8012",
                ...col(),
              }}
            >
              <div style={row(6)}>
                <span style={{ ...T.body, fontFamily: F.medium }}>{p.name}</span>
                {on && <Icon icon={Check} color={C.accent} size={16} />}
              </div>
              <span style={{ ...T.small, fontSize: 12.5 }}>{p.household}</span>
            </div>
          );
        })}
      </div>
      <Section
        title="Vitals"
        right={
          <div style={row(6)}>
            {["Well", "Feverish", "Deteriorating"].map((p) => (
              <div key={p} style={{ backgroundColor: pressed === p ? C.accentSoft : C.surface, borderRadius: 6, padding: "5px 9px" }}>
                <span style={{ ...T.label, color: C.accent }}>{p}</span>
              </div>
            ))}
          </div>
        }
      />
      <Card style={{ padding: "6px 16px", gap: 0 }}>
        {ROWS.map((r, i) => {
          const part = score.parts[r.key];
          return (
            <div key={r.key}>
              {i > 0 && <div style={{ height: 0.5, backgroundColor: C.line }} />}
              <div style={row(12, { padding: "10px 0" })}>
                <Icon icon={r.icon} color={C.accent} size={20} />
                <div style={{ flex: 1, ...col() }}>
                  <span style={T.body}>{r.label}</span>
                  <span style={{ ...T.small, fontSize: 12.5, color: part ? C.orange : C.faint }}>{part ? `+${part} to score` : "In range"}</span>
                </div>
                <Step icon={Minus} pressed={pressed === `${r.key}-`} />
                <div style={{ width: 70, ...col(), alignItems: "center" }}>
                  <span style={{ fontFamily: F.strong, fontSize: 21, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{r.key === "tempC" ? v.tempC.toFixed(1) : v[r.key]}</span>
                  <span style={{ ...T.small, fontSize: 11.5 }}>{r.unit}</span>
                </div>
                <Step icon={Plus} pressed={pressed === `${r.key}+`} />
              </div>
            </div>
          );
        })}
        <div style={{ height: 0.5, backgroundColor: C.line }} />
        <div style={row(12, { padding: "10px 0" })}>
          <Icon icon={Wind} color={C.accent} size={20} />
          <div style={{ flex: 1, ...col() }}>
            <span style={T.body}>On supplemental oxygen</span>
            <span style={{ ...T.small, fontSize: 12.5, color: v.onOxygen ? C.orange : C.faint }}>{v.onOxygen ? "+2 to score" : "Room air"}</span>
          </div>
          <div style={{ width: 51, height: 31, borderRadius: 16, backgroundColor: v.onOxygen ? C.accent : C.line, padding: 2, boxSizing: "border-box" }}>
            <div style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: C.surface, translate: v.onOxygen ? "20px 0" : "0 0", boxShadow: "0 2px 4px #0000002A" }} />
          </div>
        </div>
      </Card>
      <Section title="Alertness" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ACVPU.map((a) => {
          const on = v.consciousness === a.k;
          return (
            <div key={a.k} style={{ borderRadius: 6, padding: "9px 12px", backgroundColor: on ? C.accent : C.surface, border: `1px solid ${on ? C.accent : C.line}` }}>
              <span style={{ ...T.pillText, fontSize: 14, color: on ? "#FFFFFF" : C.ink }}>{a.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ height: 6 }} />
      <Button title={patient ? `Save visit for ${patient.name.split(" ")[0]}` : "Choose a patient to save"} icon={Check} disabled={!patient} pressed={pressed === "save"} />
      <span style={{ ...T.small, textAlign: "center" }}>Saved on this phone first, then carried to the clinic sealed, through any phones in between.</span>
    </Screen>
  );
};

// ---------------------------------------------------------------- clinic hub

export type Received = { v: VisitView; show?: number };

export const ClinicScreen = ({
  nearby,
  request = 0,
  enrollPressed,
  workers,
  showCode,
  received,
  note,
  synced,
  scroll,
  wifi,
}: {
  nearby: number;
  request?: number;
  enrollPressed?: boolean;
  workers: string[];
  showCode?: boolean;
  received: Received[];
  note?: string;
  /** The EHR has everything, even while the pills are still flipping. */
  synced?: boolean;
  scroll?: number;
  wifi?: number;
}) => (
  <Screen scroll={scroll} wifi={wifi} header={<Header title={CLINIC.name} nearby={nearby} right={<HeaderAction icon={RotateCcw} label="Reset" />} />}>
    {request > 0 && (
      <Arrive show={request} h={150}>
        <Card accent>
          <div style={row(12)}>
            <IconTile icon={UserRound} />
            <div style={{ flex: 1, ...col() }}>
              <span style={T.title}>{ADA.name} would like to enroll</span>
              <span style={T.mono}>{ADA.address}</span>
            </div>
          </div>
          <div style={row(10)}>
            <div style={{ flex: 1 }}>
              <Button title="Enroll" icon={Check} pressed={enrollPressed} />
            </div>
            <div style={{ flex: 1 }}>
              <Button title="Decline" icon={X} kind="soft" />
            </div>
          </div>
        </Card>
      </Arrive>
    )}
    <Section
      title="Health workers"
      count={workers.length}
      right={
        <div style={row(6)}>
          <Icon icon={QrCode} color={C.accent} size={16} />
          <span style={{ ...T.small, color: C.accent, fontFamily: F.medium }}>{showCode ? "Hide code" : "Enroll someone"}</span>
        </div>
      }
    />
    {(workers.length > 0 || showCode) && (
      <Card>
        {workers.map((w) => (
          <div key={w} style={row(10)}>
            <Icon icon={UserRound} color={C.accent} size={18} />
            <span style={{ ...T.body, flex: 1 }}>{w}</span>
            <span style={T.mono}>{ADDRESS[w]}</span>
          </div>
        ))}
        {workers.length > 0 && showCode && <div style={{ height: 0.5, backgroundColor: C.line }} />}
        {showCode && (
          <div style={{ ...col(12), alignItems: "center", padding: "6px 0" }}>
            <div style={{ padding: 14, backgroundColor: "#FFFFFF", borderRadius: 8 }}>
              <Qr size={196} />
            </div>
            <span style={{ ...T.small, textAlign: "center" }}>Scan this with WeCare on the health worker's phone, close by. It carries this clinic's key, not a password.</span>
          </div>
        )}
      </Card>
    )}
    <Section title="Visits received" count={received.filter((r) => (r.show ?? 1) > 0).length} />
    {received.length === 0 && (
      <Card style={row(12)}>
        <IconTile icon={Inbox} color={C.muted} bg={C.sunken} />
        <span style={{ ...T.small, flex: 1 }}>Nothing yet. Visits arrive here directly or through other health workers' phones, sickest first.</span>
      </Card>
    )}
    {received.map(({ v, show = 1 }) =>
      show <= 0 ? null : (
        <Arrive key={v.patient.id} show={show} h={VISIT_H}>
          <VisitCard
            v={v}
            footer={
              <div style={row(8, { justifyContent: "space-between", flexWrap: "wrap" })}>
                <div style={row(6)}>
                  <Icon icon={v.hops === 0 ? UserRound : Waypoints} color={C.muted} size={14} />
                  <span style={T.small}>
                    {v.from}, {v.hops === 0 ? "direct" : `via ${v.hops} other phone${v.hops === 1 ? "" : "s"}`}, {v.at}
                  </span>
                </div>
                <SyncedPill ehr={v.ehr} />
              </div>
            }
          />
        </Arrive>
      ),
    )}
    <Section title="Electronic health record" />
    <SyncCard pending={synced ? 0 : received.filter((r) => r.v.ehr === "pending").length} note={note} />
    <Section title="Carried for others" />
    <CarriedCard rows={[]} />
  </Screen>
);

/** A visit card's height in the list, for the arrival animation. Measured from a still. */
export const VISIT_H = 300;
