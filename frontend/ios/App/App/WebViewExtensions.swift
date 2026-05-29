import WebKit

// Hides the native "^ v Done" keyboard toolbar that WKWebView shows over web
// form inputs. Without this, every text field in the webview shows a browser-
// style accessory bar that breaks the native app feel.
extension WKWebView {
    override open var inputAccessoryView: UIView? { nil }
}
