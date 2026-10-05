import { Divider, EmailLayout, Heading, Paragraph, PrimaryButton } from "./layout";

type Props = {
  inviterName: string;
  tripName: string;
  /** "27 sep – 19 oct 2026", or null when the trip has no dates. */
  dates: string | null;
  role: "editor" | "viewer";
  /** "Ximena" when the invitation is for an existing traveler. */
  travelerName: string | null;
  url: string;
  expires: string;
};

/** "Alberto te invitó a España 2026": the invitation link, by email. */
export default function InvitationEmail({ inviterName, tripName, dates, role, travelerName, url, expires }: Props) {
  return (
    <EmailLayout
      preview={`${inviterName} te invitó a ${tripName} en Travio`}
      footer="Si no esperabas esta invitación, puedes ignorar este correo: sin abrir el enlace no pasa nada."
    >
      <Heading>
        {inviterName} te invitó a {tripName}
      </Heading>
      {dates && <Paragraph>{dates}</Paragraph>}
      <Paragraph>
        {travelerName ? `Entrarás como ${travelerName}. ` : ""}
        {role === "editor"
          ? "Podrás ver el itinerario, los hospedajes y los documentos, y agregar o cambiar planes."
          : "Podrás ver el itinerario, los hospedajes y los documentos del viaje."}
      </Paragraph>
      <PrimaryButton href={url}>Ver la invitación</PrimaryButton>
      <Divider />
      <Paragraph muted>
        Si aún no tienes cuenta, podrás crearla al abrir el enlace. Sirve para una sola persona y caduca el {expires}.
      </Paragraph>
    </EmailLayout>
  );
}
