import UIKit
import Capacitor
import SwiftUI

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var overlayWindow: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        showSplashOverlay()
        return true
    }

    // ─── Overlay orchestration ────────────────────────────────────────────────

    private func showSplashOverlay() {
        let overlay = UIWindow(frame: UIScreen.main.bounds)
        overlay.windowLevel = .alert + 1

        let splashVC = makeHostingController(
            SplashScreenView {
                let hasSeen = UserDefaults.standard.bool(forKey: "hasSeenOnboarding")
                if hasSeen {
                    self.dismissOverlay(navigateTo: nil)
                } else {
                    self.showOnboarding(in: overlay)
                }
            }
        )

        overlay.rootViewController = splashVC
        overlay.makeKeyAndVisible()
        self.overlayWindow = overlay
    }

    private func showOnboarding(in overlay: UIWindow) {
        let vc = makeHostingController(
            OnboardingView {
                self.showAuthChoice(in: overlay)
            }
        )
        UIView.transition(with: overlay, duration: 0.38, options: .transitionCrossDissolve) {
            overlay.rootViewController = vc
        }
    }

    private func showAuthChoice(in overlay: UIWindow) {
        let vc = makeHostingController(
            AuthChoiceView(
                onRegister: { self.dismissOverlay(navigateTo: "/register") },
                onLogin:    { self.dismissOverlay(navigateTo: "/login") }
            )
        )
        UIView.transition(with: overlay, duration: 0.38, options: .transitionCrossDissolve) {
            overlay.rootViewController = vc
        }
    }

    // ─── Dismiss + navigate ───────────────────────────────────────────────────

    private func dismissOverlay(navigateTo path: String?) {
        guard let overlay = overlayWindow else { return }
        UIView.animate(withDuration: 0.45, delay: 0, options: .curveEaseOut) {
            overlay.alpha = 0
        } completion: { _ in
            overlay.isHidden = true
            self.overlayWindow = nil
            self.window?.makeKeyAndVisible()

            if let path = path {
                // WebView should be loaded by now; navigate to target path
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.navigateWebView(to: path)
                }
            }
        }
    }

    private func navigateWebView(to path: String) {
        guard let bridgeVC = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridgeVC.webView else { return }
        webView.evaluateJavaScript("window.location.replace('\(path)')")
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private func makeHostingController<V: View>(_ view: V) -> UIHostingController<V> {
        let vc = UIHostingController(rootView: view)
        vc.view.backgroundColor = UIColor(red: 0.039, green: 0.039, blue: 0.059, alpha: 1)
        return vc
    }

    // ─── Capacitor delegates ──────────────────────────────────────────────────

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return false
    }
}
