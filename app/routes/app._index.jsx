import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  AppProvider,
  Page,
  Card,
  TextField,
  BlockStack,
  InlineGrid,
  InlineStack,
  Text,
  Badge,
  Button,
  Divider,
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  let config = { phone: "", pixelId: "" };
  try {
    const response = await admin.graphql(
      `#graphql
        query getSettings {
          currentAppInstallation {
            metafield(namespace: "whatsapp_settings", key: "config") {
              value
            }
          }
        }
      `
    );
    const res = await response.json();
    const raw = res.data?.currentAppInstallation?.metafield?.value;
    if (raw) config = JSON.parse(raw);
  } catch (e) {
    console.error("Loader query error:", e);
  }

  const totalClicks = await prisma.whatsAppClick.count({ where: { shop } });
  const mobileClicks = await prisma.whatsAppClick.count({ where: { shop, device: "mobile" } });
  const desktopClicks = await prisma.whatsAppClick.count({ where: { shop, device: "desktop" } });

  return Response.json({ config, totalClicks, mobileClicks, desktopClicks });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const phone = formData.get("phone") || "";
  const pixelId = formData.get("pixelId") || "";

  try {
    const appRes = await admin.graphql(`#graphql { currentAppInstallation { id } }`);
    const appData = await appRes.json();
    const instId = appData.data?.currentAppInstallation?.id;

    if (instId) {
      await admin.graphql(
        `#graphql
          mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              userErrors { message }
            }
          }
        `,
        {
          variables: {
            metafields: [
              {
                namespace: "whatsapp_settings",
                key: "config",
                type: "json",
                value: JSON.stringify({ phone, pixelId }),
                ownerId: instId,
              },
            ],
          },
        }
      );
    }
  } catch (e) {
    console.error("Action mutation error:", e);
  }

  return Response.json({ success: true });
};

export default function Index() {
  const { config, totalClicks, mobileClicks, desktopClicks } = useLoaderData();
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState("");
  const [pixelId, setPixelId] = useState("");
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  useEffect(() => {
    setMounted(true);
    if (config?.phone) setPhone(config.phone);
    if (config?.pixelId) setPixelId(config.pixelId);
  }, [config]);

  // Client hydration مکمل ہونے سے پہلے کچھ رینڈر نہ کریں تاکہ کریش نہ ہو
  if (!mounted) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        Loading dashboard...
      </div>
    );
  }

  const handleSave = () => {
    submit({ phone, pixelId }, { method: "post" });
  };

  return (
    <AppProvider i18n={enTranslations}>
      <Page title="WhatsApp Orders & Analytics">
        <BlockStack gap="500">
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  TOTAL CLICKS
                </Text>
                <Text variant="heading2xl" as="p">
                  {totalClicks}
                </Text>
                <InlineStack>
                  <Badge tone="success">Store Traffic</Badge>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  MOBILE ORDERS
                </Text>
                <Text variant="heading2xl" as="p">
                  {mobileClicks}
                </Text>
                <InlineStack>
                  <Badge tone="info">Smartphones</Badge>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3" tone="subdued">
                  DESKTOP ORDERS
                </Text>
                <Text variant="heading2xl" as="p">
                  {desktopClicks}
                </Text>
                <InlineStack>
                  <Badge tone="attention">PC Users</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Widget Configuration
                </Text>
                <BlockStack gap="100" align="end">
                  <Text variant="bodySm" tone="subdued">
                    Status
                  </Text>
                  {phone ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="warning">Number Missing</Badge>
                  )}
                </BlockStack>
              </InlineStack>

              <Divider />

              <TextField
                label="WhatsApp Business Number"
                type="text"
                value={phone}
                onChange={(val) => setPhone(val)}
                helpText="Country code bina + ya spaces ke likhein (e.g. 923001234567)"
                autoComplete="off"
              />

              <TextField
                label="Meta Pixel ID (Optional)"
                type="text"
                value={pixelId}
                onChange={(val) => setPixelId(val)}
                helpText="Track WhatsApp CTA clicks on Facebook/Meta"
                autoComplete="off"
              />

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={isSaving}
                >
                  Save Settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AppProvider>
  );
}