import { EmailLayout, Heading, NotificationFooter, Paragraph, PrimaryButton } from "./layout";

type Props = {
  /**
   * "requested": to the owner, someone asked to join through the group link.
   * "approved": to that person, the owner let them in.
   */
  kind: "requested" | "approved";
  /** Who asked (for "requested"). */
  requesterName: string;
  /** Where they signed in from (for "requested"), so the owner can tell who it is. */
  requesterEmail?: string | null;
  tripName: string;
  /** For "approved": the access they got. */
  role?: "editor" | "viewer";
  url: string;
  /** For "requested" only: the owner's notification preferences. */
  preferencesUrl?: string;
  unsubscribeUrl?: string;
};

/** Requests through a group link: "Ana quiere unirse a …" and "Ya puedes ver …". */
export default function JoinRequestEmail({
  kind,
  requesterName,
  requesterEmail,
  tripName,
  role,
  url,
  preferencesUrl,
  unsubscribeUrl,
}: Props) {
  if (kind === "approved") {
    return (
      <EmailLayout
        preview={`Ya puedes ver ${tripName} en Travio`}
        footer="Recibes este correo porque pediste unirte a este viaje en Travio."
      >
        <Heading>Ya puedes ver {tripName}</Heading>
        <Paragraph>
          {role === "editor"
            ? "Aceptaron tu solicitud: puedes ver el itinerario, los hospedajes y los documentos, y agregar o cambiar planes."
            : "Aceptaron tu solicitud: puedes ver el itinerario, los hospedajes y los documentos del viaje."}
        </Paragraph>
        <PrimaryButton href={url}>Abrir el viaje</PrimaryButton>
      </EmailLayout>
    );
  }

  return (
    <EmailLayout
      preview={`${requesterName} quiere unirse a ${tripName}`}
      footer={
        preferencesUrl && unsubscribeUrl ? (
          <NotificationFooter preferencesUrl={preferencesUrl} unsubscribeUrl={unsubscribeUrl} />
        ) : undefined
      }
    >
      <Heading>
        {requesterName} quiere unirse a {tripName}
      </Heading>
      <Paragraph>
        {requesterEmail ? `Lo pidió con el enlace para grupo, desde la cuenta ${requesterEmail}. ` : "Lo pidió con el enlace para grupo. "}
        No verá nada del viaje hasta que lo aceptes. Si no sabes quién es, recházalo.
      </Paragraph>
      <PrimaryButton href={url}>Ver la solicitud</PrimaryButton>
    </EmailLayout>
  );
}
