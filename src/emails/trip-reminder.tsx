import { Section, Text } from "@react-email/components";

import { colors, Divider, EmailLayout, Heading, NotificationFooter, Paragraph, PrimaryButton } from "./layout";

type Props = {
  tripName: string;
  dates: string;
  /** First day's plans: "19:40 · Vuelo Ciudad de México → Barcelona". */
  firstDay: string[];
  documents: number;
  tripUrl: string;
  documentsUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
};

/** The day before a trip starts. */
export default function TripReminderEmail({ tripName, dates, firstDay, documents, tripUrl, documentsUrl, preferencesUrl, unsubscribeUrl }: Props) {
  return (
    <EmailLayout
      preview={`Mañana empieza ${tripName}`}
      footer={<NotificationFooter preferencesUrl={preferencesUrl} unsubscribeUrl={unsubscribeUrl} />}
    >
      <Heading>Mañana empieza {tripName}</Heading>
      <Paragraph>{dates}</Paragraph>
      {firstDay.length > 0 && (
        <Section style={{ margin: "8px 0 12px", padding: "12px 16px", borderRadius: 12, backgroundColor: colors.soft }}>
          <Text style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: colors.primary }}>El primer día</Text>
          {firstDay.map((line, i) => (
            <Text key={i} style={{ margin: "0 0 4px", fontSize: 14, lineHeight: "20px", color: colors.text }}>
              {line}
            </Text>
          ))}
        </Section>
      )}
      <PrimaryButton href={tripUrl}>Abrir el viaje</PrimaryButton>
      {documents > 0 && (
        <>
          <Divider />
          <Paragraph>
            Tienes {documents === 1 ? "1 documento" : `${documents} documentos`} en el viaje. Ábrelos una vez desde tu teléfono y toca
            «Descargar para el viaje» en Documentos para tenerlos sin conexión.
          </Paragraph>
          <Text style={{ margin: 0 }}>
            <a href={documentsUrl} style={{ color: colors.primary, fontWeight: 600, fontSize: 14 }}>
              Ir a Documentos →
            </a>
          </Text>
        </>
      )}
    </EmailLayout>
  );
}
