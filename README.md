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
* Works on input fields, text areas, content editable DIVs
* Works on multi-frame pages, but only if they are from the same domain
* Only works in Chrome
* Tiny overhead per page (<1k), no 3rd party library dependencies, completely passive, so it does not interfere with your web app execution in any way

##Questions, suggestions

Twitter: [@facundofarias](https://twitter.com/facundofarias)

##Resources for more info

* [Stripe Test Data](https://stripe.com/docs/testing)
* [PayPal Test Data](http://www.paypalobjects.com/en_US/vhelp/paypalmanager_help/credit_card_numbers.htm)
* [Spreedly Test Data](https://docs.spreedly.com/reference/test-data)
* [BrainTree Test Data](https://www.braintreepayments.com/docs/ruby/reference/sandbox)
* [MercadoPago Test Data](https://developers.mercadopago.com/documentation/pay-test-users)
* [Mango Test Data](https://developers.getmango.com/es/docs/test-card-numbers)
* [Worldpay Test Data](http://support.worldpay.com/support/kb/bg/testandgolive/tgl5103.html)

###Running tests

Install Grunt, Node and NPM (instructions are in [GruntFile.js](GruntFile.js)). Then run tests
from the command line using

    grunt jasmine

###Running from a local setup

Load [manifest.json](src/manifest.json) from the **src** folder in Chrome as an [unpacked
extension](https://developer.chrome.com/extensions/getstarted#unpacked).

##Credits

Special thanks to [@gojkoadzic](http://twitter.com/gojkoadzic), and his [bugmagnet](https://github.com/gojko/bugmagnet) which I used as baseline.
