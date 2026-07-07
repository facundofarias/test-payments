#Test Payments

Helps to test common payment frameworks with testing data, such as:
- Name, Address, Phone per location
- Payment test data for providers: Stripe, Spreedly, BrainTree, MercadoPago, Mango, etc.

Original fork of [bugmagnet](https://github.com/gojko/bugmagnet).

##Usage

The easiest way to install the extension is from the [Chrome Web
store](https://chrome.google.com/webstore/detail/test-payments/lmeopbbdngpgcbdagpjgbdlkcafofpji?hl=en&gl=ES). After
installation, just right-click on any editable item on the page and you'll see the
Test Payments submenu. Click an item there, and it will be inserted into the
editable field.

Alternatively, you can load the extension from the source files - see _Running
from a local setup_ below.

##Features

* Convenient access to common test payment data
* Generates fresh fake names, addresses and phones on demand using Chrome's built-in on-device AI (Gemini Nano), with static fallbacks when it isn't available (see the _AI Generated_ menu; requires Chrome 138+)
* Works on input fields, text areas, content editable DIVs
* Works on multi-frame pages, but only if they are from the same domain
* Only works in Chrome
* Tiny overhead per page (<1k), no 3rd party library dependencies, completely passive, so it does not interfere with your web app execution in any way

##Questions, suggestions

Twitter: [@facundofarias](https://twitter.com/facundofarias)

##Resources for more info

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

###Running tests

Install [Node and npm](https://nodejs.org/en/download), then install the dev
dependencies and run the suite from the command line:

    npm install
    npm test

The specs run under [Jasmine](https://jasmine.github.io/) with a
[jsdom](https://github.com/jsdom/jsdom) DOM, so no browser is required.

###Running from a local setup

Load [manifest.json](src/manifest.json) from the **src** folder in Chrome as an [unpacked
extension](https://developer.chrome.com/extensions/getstarted#unpacked).

##Credits

Special thanks to [@gojkoadzic](http://twitter.com/gojkoadzic), and his [bugmagnet](https://github.com/gojko/bugmagnet) which I used as baseline.
