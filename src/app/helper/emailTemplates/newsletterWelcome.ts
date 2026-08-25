export const newsletterWelcomeTemplate = (email: string) => {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>Welcome to Elysia</title>

  <style>
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #ffffff !important;
      font-family: Arial, Helvetica, sans-serif;
    }

    table {
      border-spacing: 0;
      border-collapse: separate;
    }

    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 10px !important;
      }

      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }

      .header {
        padding: 18px 16px !important;
      }

      .content {
        padding: 24px 18px 10px !important;
      }

      .title {
        font-size: 27px !important;
        line-height: 34px !important;
      }

      .description {
        font-size: 13px !important;
        line-height: 20px !important;
      }

      .confirmation-wrapper {
        padding: 14px 18px !important;
      }

      .confirmation-card {
        padding: 18px 14px !important;
      }

      .tagline {
        padding: 12px 18px 24px !important;
      }

      .tagline-title {
        font-size: 20px !important;
        line-height: 27px !important;
      }

      .footer {
        padding: 18px !important;
      }
    }
  </style>
</head>

<body
  style="
    margin:0;
    padding:0;
    width:100%;
    background-color:#ffffff;
    font-family:Arial, Helvetica, sans-serif;
  "
>

  <!-- OUTER WRAPPER -->
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      width:100%;
      background-color:#ffffff;
    "
  >
    <tr>
      <td
        align="center"
        class="email-wrapper"
        style="
          padding:16px 10px;
          background-color:#ffffff;
        "
      >

        <!-- EMAIL CONTAINER -->
        <table
          role="presentation"
          width="560"
          cellpadding="0"
          cellspacing="0"
          border="0"
          class="email-container"
          style="
            width:100%;
            max-width:560px;
            background-color:#111116;
            border:1px solid #2a2026;
            border-radius:14px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td
              align="center"
              class="header"
              style="
                padding:20px;
                background-color:#111116;
                border-bottom:1px solid #261a20;
              "
            >
              <div
                style="
                  font-family:Georgia, 'Times New Roman', serif;
                  font-size:27px;
                  line-height:32px;
                  font-style:italic;
                  font-weight:bold;
                  color:#ffffff;
                "
              >
                Elysia<span style="color:#ff294f;">♥</span>
              </div>
            </td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td
              align="center"
              class="content"
              style="
                padding:26px 30px 12px;
                background-color:#111116;
              "
            >
              <div
                style="
                  margin-bottom:10px;
                  font-size:10px;
                  line-height:14px;
                  font-weight:bold;
                  letter-spacing:2.5px;
                  text-transform:uppercase;
                  color:#d92f62;
                "
              >
                Welcome to Elysia
              </div>

              <div
                class="title"
                style="
                  margin:0;
                  font-family:Georgia, 'Times New Roman', serif;
                  font-size:30px;
                  line-height:36px;
                  color:#ffffff;
                "
              >
                You're on the
                <span
                  style="
                    color:#d92f62;
                    font-style:italic;
                  "
                >
                  list.
                </span>
              </div>

              <div
                class="description"
                style="
                  max-width:430px;
                  margin:14px auto 0;
                  font-size:13px;
                  line-height:21px;
                  color:#b8b8c0;
                "
              >
                Thanks for joining Elysia. You'll be among the first
                to know when we're ready for you.
              </div>

              <div
                class="description"
                style="
                  max-width:430px;
                  margin:7px auto 0;
                  font-size:13px;
                  line-height:21px;
                  color:#b8b8c0;
                "
              >
                A new kind of AI companionship is coming — designed around
                meaningful conversation, personalization, and genuine connection.
              </div>
            </td>
          </tr>

          <!-- CONFIRMATION -->
          <tr>
            <td
              class="confirmation-wrapper"
              style="
                padding:14px 30px;
                background-color:#111116;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  background-color:#190d13;
                  border:1px solid #682039;
                  border-radius:12px;
                "
              >
                <tr>
                  <td
                    align="center"
                    class="confirmation-card"
                    style="padding:18px 16px;"
                  >

                    <!-- CHECK ICON -->
                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      align="center"
                    >
                      <tr>
                        <td
                          align="center"
                          valign="middle"
                          width="38"
                          height="38"
                          style="
                            width:38px;
                            height:38px;
                            border:1px solid #d92f62;
                            border-radius:50%;
                            color:#d92f62;
                            font-size:20px;
                            line-height:38px;
                          "
                        >
                          ✓
                        </td>
                      </tr>
                    </table>

                    <div
                      style="
                        margin-top:12px;
                        font-family:Georgia, 'Times New Roman', serif;
                        font-size:17px;
                        line-height:22px;
                        font-weight:bold;
                        color:#ffffff;
                      "
                    >
                      Your spot is confirmed.
                    </div>

                    <div
                      style="
                        margin-top:6px;
                        font-size:12px;
                        line-height:18px;
                        color:#d92f62;
                        word-break:break-all;
                        overflow-wrap:anywhere;
                      "
                    >
                      ${email}
                    </div>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TAGLINE -->
          <tr>
            <td
              align="center"
              class="tagline"
              style="
                padding:12px 30px 25px;
                background-color:#111116;
              "
            >
              <div
                class="tagline-title"
                style="
                  font-family:Georgia, 'Times New Roman', serif;
                  font-size:20px;
                  line-height:27px;
                  color:#ffffff;
                "
              >
                Something Different Is
                <span
                  style="
                    color:#d92f62;
                    font-style:italic;
                  "
                >
                  Coming.
                </span>
              </div>

              <div
                style="
                  margin-top:8px;
                  font-size:12px;
                  line-height:18px;
                  color:#777780;
                "
              >
                Private AI companionship — designed for connection.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              class="footer"
              style="
                padding:17px 20px 20px;
                background-color:#111116;
                border-top:1px solid #261a20;
              "
            >
              <div
                style="
                  font-family:Georgia, 'Times New Roman', serif;
                  font-size:17px;
                  line-height:22px;
                  font-style:italic;
                  font-weight:bold;
                  color:#ffffff;
                "
              >
                Elysia<span style="color:#ff294f;">♥</span>
              </div>

              <div
                style="
                  margin-top:7px;
                  font-size:10px;
                  line-height:15px;
                  color:#65656e;
                "
              >
                © ${year} Meet Elysia. All rights reserved.
              </div>

              <div
                style="
                  margin-top:4px;
                  font-size:9px;
                  line-height:14px;
                  color:#55555e;
                "
              >
                You received this email because you joined the Elysia waitlist.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
};
