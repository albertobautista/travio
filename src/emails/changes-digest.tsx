import { Link, Section, Text } from "@react-email/components";

import { colors, EmailLayout, Heading, NotificationFooter, Paragraph } from "./layout";

type Props = {
  trips: { name: string; url: string; lines: string[]; more: number }[];
  /** "en la última hora" / "desde ayer". */
  period: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
};

/** What other people changed in your trips, grouped by trip. */
export default function ChangesDigestEmail({ trips, period, preferencesUrl, unsubscribeUrl }: Props) {
  const single = trips.length === 1 ? trips[0] : null;
  return (
    <EmailLayout
      preview={single ? `Cambios en ${single.name} ${period}` : `Cambios en ${trips.length} viajes ${period}`}
      footer={<NotificationFooter preferencesUrl={preferencesUrl} unsubscribeUrl={unsubscribeUrl} />}
    >
      <Heading>{single ? `Cambios en ${single.name}` : "Cambios en tus viajes"}</Heading>
      <Paragraph muted>Lo que otras personas agregaron o cambiaron {period}.</Paragraph>
      {trips.map((trip) => (
        <Section key={trip.url} style={{ marginTop: 16 }}>
          {!single && <Text style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>{trip.name}</Text>}
          {trip.lines.map((line, i) => (
            <Text key={i} style={{ margin: "0 0 6px", fontSize: 14, lineHeight: "20px", color: colors.secondary }}>
              • {line}
            </Text>
          ))}
          {trip.more > 0 && (
            <Text style={{ margin: "0 0 6px", fontSize: 14, color: colors.muted }}>
              y {trip.more === 1 ? "1 cambio más" : `${trip.more} cambios más`}
            </Text>
          )}
          <Link href={trip.url} style={{ fontSize: 14, fontWeight: 600, color: colors.primary }}>
            Ver el itinerario →
          </Link>
        </Section>
      ))}
    </EmailLayout>
  );
}
