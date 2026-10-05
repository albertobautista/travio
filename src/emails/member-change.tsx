import { EmailLayout, Heading, NotificationFooter, Paragraph, PrimaryButton } from "./layout";

type Props = {
  kind: "joined" | "left";
  memberName: string;
  tripName: string;
  /** For "joined": the access they got. */
  role?: "editor" | "viewer";
  url: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
};

/** To the owner (and whoever invited): someone joined or left the trip. */
export default function MemberChangeEmail({ kind, memberName, tripName, role, url, preferencesUrl, unsubscribeUrl }: Props) {
  const joined = kind === "joined";
  return (
    <EmailLayout
      preview={joined ? `${memberName} aceptó tu invitación a ${tripName}` : `${memberName} salió de ${tripName}`}
      footer={<NotificationFooter preferencesUrl={preferencesUrl} unsubscribeUrl={unsubscribeUrl} />}
    >
      <Heading>{joined ? `${memberName} se unió a ${tripName}` : `${memberName} salió de ${tripName}`}</Heading>
      <Paragraph>
        {joined
          ? `Aceptó la invitación ${role === "editor" ? "y puede editar el viaje" : "con acceso de solo lectura"}. Puedes cambiar su acceso cuando quieras.`
          : "Ya no puede ver el viaje ni sus documentos. Si era viajero, sigue en la lista de viajeros, sin su cuenta."}
      </Paragraph>
      <PrimaryButton href={url}>Ver quién tiene acceso</PrimaryButton>
    </EmailLayout>
  );
}
