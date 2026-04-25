**Comparison: Fetch API vs jQuery AJAX**
<br>
Building WeatherNow gave me experience with both the native Fetch API and jQuery's AJAX methods side by side in a real application. Here is my reflection.

**Syntax Verbosity:**
The Fetch API with async/await is clean and reads almost like synchronous code. Defining the request, awaiting the response, and awaiting the JSON parse feels natural once you understand the two-step process.


**Promise Chaining Style:**
Fetch uses the modern async/await pattern, making multi-step chains (geocode → weather) straightforward to read top-to-bottom without nesting. jQuery uses its own Deferred object, which predates native Promises. The .done(), .fail(), and .always() chaining methods are readable and expressive, but they are a custom API — not standard Promise.then/catch — which means you cannot use await on them without wrapping, and they behave subtly differently from native Promises in error propagation.


**Error Handling**
Fetch requires explicit HTTP error checking (if (!response.ok)) because it only rejects on network failure, not on 4xx/5xx responses. This is a common footgun for beginners. jQuery's .fail() handler does trigger on HTTP errors in some configurations, but its behaviour can also vary depending on dataType. Overall, Fetch gives more predictable, explicit control once you know the response.ok pattern.


**Browser Support**
jQuery AJAX works in all browsers including very old ones (IE8+) out of the box — that was its original strength. The native Fetch API is supported in all modern browsers (Chrome, Firefox, Safari, Edge) without any polyfill, but requires a polyfill for Internet Explorer. In 2024, this is rarely a concern.


**Personal Preference**
I prefer the Fetch API with async/await. It uses native language features (no library required), produces readable sequential code, integrates naturally with AbortController for timeouts, and follows the standard Promise specification. jQuery AJAX remains useful for quick integrations in jQuery-heavy legacy projects, but for new development, Fetch is cleaner and future-proof.
