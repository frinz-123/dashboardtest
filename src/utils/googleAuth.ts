import { google } from "googleapis";

const credentials = {
  type: "service_account",
  project_id: "light-legend-427200-q9",
  private_key_id: "d6d5b9ed0d50c7df921a85d7823a0a6c0ad31c6c",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCL9FQTF3JAkzgU\nw8srlOOAdn2FKAF78Xa0XRdOYJmPs1LF+hzbO6P73zr9qHBLOZ/+Y3WFFrmLNnny\n3G+vlcPAtzsWj+CYRvKxeKpr4VtBTd/01btNZB32DRjW4MzazRm9tJmbqdTdF2tr\nYaRWohCpHJMBMsJ5moP++TgMA3I5nFfljkbr1Liso/yKJKG7Xm1UCnSvQfRkXSrV\nJaq0rApbY8/rA5TQF0NW28KtC++EIJnzL7WthRQGqw6bjuAHX70Q1tt/ntJ0K0Oc\nvXG3svTenwHrvyqWIFjgUiUI+3rGZdz08aZGMLFzEpGDHf2eLGp0x+dxx9ogoSdi\n9IXVA+6zAgMBAAECggEADBW16Mwefnr33bsmYQYDOwWAQy44KpaoFFzxdUAcIm9u\nl0/IjBmzSD13X43a3HQGX7YA4NQcg2vZzeHA9x1sgMiRnpof36ZIsJBlztjvw0zR\nKNgHy1/4wlVRLsTMi5woO9xLY0if69No4CXXRe/Kln+0JedXKZ7xBORKNadahqTb\nrotXOk5ucr20+f5kUBwVQLM1pnJtC2MwWpx4YEDag/tah/ZoH7cYaHcJ5mi9eusL\nVwvVwMx5b1ox8yNVA+i00imBNUULul1U67YREXL05U4u5ixgyej3raJmCZ56T0/9\ncGrne9KgN6ezOsvEvTwtoYejHp2K8oWu227Hut3amQKBgQDFSpKD9nuxAAwBb4xS\nniMA5mamskhCuCiOF33+oV1JAuytMaQHslKp9qTHo/5QmfykfDxvWKo8UTqtaEI8\n6pRBrVkGSm9Oc5546qvIb+Cq5nNdDOIXVG2RnNBI3lpca9Ewquo4wWOto3mbgbfs\n6zOx4t6WnmBy9jFQq30jmIUB7wKBgQC1meWPZ0WLLByV1IzlMKqZ8ntkPPAgbEYt\nGnIFV4QCrRxpMKr1YjPg03XMmeum+3zt/xACfdR0Gm0b4ZZeHTbvBadjt3VobxAa\nlVf4d+hwly1mJ68GZWbjX9KUMU0djI4IyCLYp2cXs+pwcQAHsleLkloExRQveaot\nnO2gribTfQKBgB3qBbcum2imGivpjvxD8AjF5pCl/aDoLXYGB9ug+fUFFX/ZRAbK\nug/9TtTaf8gW4SDLmZpEdmN46Y27fjegVeRzdUkn5iKeE0xAQNW+aPFgyeM0/d8N\ntSNcBJTX6hmTW3+mmqcKY6PDYr/6djndG9SAEsIBt5wWyjlyFyJbkOdPAoGBALKj\nlOIgIJTq66On1oGOAgQ2N5M/Lqd2WwH7RbZjhIRtbck8CrAfzhCXcwW1U86LDTXA\n9iq9RMSBSltm6dfivSsbULISwffdaOX9iu/sZEZ9MDeRSebs0O1SUX9dkBJFNWMG\nHOEqq4rxfOjm/7SShvPRH6QZieW5tOHxwP+S0LaxAoGAft9TEPSxzuplIZxTFpck\nVtgSkAqzy3co1PxOk3p1BgG0vMnrEZZOs6VW/qq1QYOm/4w935Pzl0cBQzBMYBnp\n58cH9OkbB0ao2mmeVHmvyhb0jggaTCfJ9QP+iF4GiLOFQm2fFWxKDAglQEtkBVHx\nNWkTHRHBD62hk+H2ffZ1TQo=\n-----END PRIVATE KEY-----\n",
  client_email: "cesar-reyes@light-legend-427200-q9.iam.gserviceaccount.com",
  client_id: "113188820672311170516",
};

export const sheetsAuth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const driveClientId =
  process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const driveClientSecret =
  process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const driveRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const driveRedirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

const driveOAuthClient =
  driveClientId && driveClientSecret && driveRefreshToken
    ? new google.auth.OAuth2(driveClientId, driveClientSecret, driveRedirectUri)
    : null;

if (driveOAuthClient) {
  driveOAuthClient.setCredentials({ refresh_token: driveRefreshToken });
}

// Prefer OAuth for Drive to use a real user's storage quota; fall back to
// service account for Shared Drives or legacy setups.
export const driveAuth =
  driveOAuthClient ||
  new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
