import type { ReactNode } from "react";
import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

/**
 * Shared frame for every Travio email. Email clients ignore most CSS, so
 * styles are inline and the layout is a single centered column. Colors are
 * the app's tokens (globals.css).
 */
export const colors = {
  primary: "#1F5EDB",
  text: "#0B1B33",
  secondary: "#33455E",
  muted: "#5A6B82",
  page: "#F7F9FC",
  border: "#E3E8F0",
  soft: "#E8F0FE",
};

export function EmailLayout({
  preview,
  children,
  footer,
}: {
  /** The grey line inbox lists show next to the subject. */
  preview: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: colors.page, fontFamily: "Helvetica, Arial, sans-serif", color: colors.text }}>
        <Container style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px" }}>
          <Text style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700, color: colors.primary }}>Travio</Text>
          <Section style={{ backgroundColor: "#ffffff", border: `1px solid ${colors.border}`, borderRadius: 16, padding: "28px 24px" }}>
            {children}
          </Section>
          <Text style={{ margin: "16px 4px 0", fontSize: 12, lineHeight: "18px", color: colors.muted }}>
            {footer ?? "Travio · Tu viaje, todo en un lugar."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={{ margin: "0 0 12px", fontSize: 22, lineHeight: "28px", fontWeight: 700 }}>{children}</Text>;
}

export function Paragraph({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text style={{ margin: "0 0 12px", fontSize: 15, lineHeight: "22px", color: muted ? colors.muted : colors.secondary }}>
      {children}
    </Text>
  );
}

export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: "inline-block",
        marginTop: 8,
        padding: "12px 20px",
        borderRadius: 12,
        backgroundColor: colors.primary,
        color: "#ffffff",
        fontSize: 15,
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}

/** "No quieres estos correos" footer for notifications. */
export function NotificationFooter({ preferencesUrl, unsubscribeUrl }: { preferencesUrl: string; unsubscribeUrl: string }) {
  return (
    <>
      Recibes este correo porque participas en un viaje en Travio.{" "}
      <Link href={preferencesUrl} style={{ color: colors.muted, textDecoration: "underline" }}>
        Elegir qué avisos recibir
      </Link>{" "}
      ·{" "}
      <Link href={unsubscribeUrl} style={{ color: colors.muted, textDecoration: "underline" }}>
        No recibir más avisos
      </Link>
    </>
  );
}

export function Divider() {
  return <Hr style={{ borderColor: colors.border, margin: "20px 0" }} />;
}
