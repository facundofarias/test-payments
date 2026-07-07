# Test Payments

A Chrome extension that puts realistic payment and identity test data one
right-click away. Right-click any editable field, pick a value from the
**Test Payments** menu, and it's inserted instantly — no more hunting through
provider docs or keeping a scratch file of test cards.

Built for developers and QA engineers testing checkout, payment, and signup
flows. Originally a fork of [bugmagnet](https://github.com/gojko/bugmagnet).

## Features

* **Payment sandbox test cards** for 12 providers — Stripe, Adyen, Braintree,
  Checkout.com, PayPal, Worldpay, Mollie, Paddle, Square, MercadoPago, Spreedly,
  and Opayo (formerly SagePay). Each has the expected test values (expiry, CVV,
  AVS, etc.), successful cards by brand, decline scenarios, and 3D Secure cards.
  All numbers are official, published sandbox values.
* **AI-generated identity data** — the _AI Generated_ menu creates fresh
  fictional names, addresses, phones, emails, and company names on demand using
  Chrome's built-in on-device AI (Gemini Nano). Runs fully offline; falls back
  to static values when unavailable. Requires Chrome 138+.
* **Static identity data** — ready-made names, addresses, and phone numbers for
  US, UK, and AU locales, always available.
* Works on input fields, text areas, and contenteditable elements, including
  same-domain iframes. (Fields inside cross-origin iframes — e.g. Stripe Elements
  or Braintree Hosted Fields — are not supported.)
* **Minimal permissions** (Manifest V3): no broad host access. The extension
  injects into a page only when you click a menu item (`activeTab` + `scripting`),
  so nothing runs on your pages otherwise.
* **Private by design**: no data collection, no tracking, no external servers.
  See the [privacy policy](PRIVACY.md).
* Chrome only. No third-party library dependencies.

## Usage

The easiest way to install is from the [Chrome Web Store](https://chrome.google.com/webstore/detail/test-payments/lmeopbbdngpgcbdagpjgbdlkcafofpji).
After installing, right-click any editable field on a page, open the
**Test Payments** submenu, and click an item to insert it.

Alternatively, load it from source — see _Running from a local setup_ below.

## Running from a local setup

Load the `src/` folder in Chrome as an [unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked):
open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
and select the `src/` directory.

## Running the tests

Install [Node and npm](https://nodejs.org/en/download), then:

    npm install
    npm test

The specs run under [Jasmine](https://jasmine.github.io/) with a
[jsdom](https://github.com/jsdom/jsdom) DOM, so no browser is required.

## Packaging

`./pack.sh` reads the version from `src/manifest.json` and produces
`src/<version>.zip`, ready to upload to the Chrome Web Store.

## Resources for more info

* [Stripe Test Data](https://docs.stripe.com/testing)
* [Adyen Test Data](https://docs.adyen.com/development-resources/test-cards-and-credentials/test-card-numbers)
* [Braintree Test Data](https://developer.paypal.com/braintree/docs/reference/general/testing)
* [Checkout.com Test Data](https://www.checkout.com/docs/developer-resources/testing/test-cards)
* [PayPal Test Data](https://developer.paypal.com/tools/sandbox/card-testing/)
* [Worldpay Test Data](https://docs.worldpay.com/access/products/card-payments/testing)
* [Mollie Test Data](https://docs.mollie.com/docs/testing)
* [Paddle Test Data](https://developer.paddle.com/concepts/payment-methods/credit-debit-card)
* [Square Test Data](https://developer.squareup.com/docs/devtools/sandbox/payments)
* [MercadoPago Test Data](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/cards)
* [Spreedly Test Data](https://developer.spreedly.com/docs/test-data)
* [Opayo (formerly SagePay) Test Data](https://developer.elavon.com/products/en-uk/opayo/v1/test-in-sandbox)

## Questions, suggestions

Twitter: [@facundofarias](https://twitter.com/facundofarias)

## Credits

Special thanks to [@gojkoadzic](http://twitter.com/gojkoadzic) and his
[bugmagnet](https://github.com/gojko/bugmagnet), which this was based on.

## License

[MIT](LICENSE) © Facundo Farias. Icons by
[Freepik](http://www.freepik.com) from [Flaticon](http://www.flaticon.com),
licensed under [CC BY 3.0](http://creativecommons.org/licenses/by/3.0/).
