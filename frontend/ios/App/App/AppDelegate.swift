import UIKit
import Capacitor
import Network
import SwiftUI
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var overlayWindow: UIWindow?
    private var pathMonitor: NWPathMonitor?
    private var isConnected = true

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        startNetworkMonitor()
        showSplashOverlay()
        return true
    }

    // ─── Network monitoring ───────────────────────────────────────────────────

    private func startNetworkMonitor() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
            }
        }
        monitor.start(queue: DispatchQueue(label: "com.deutschflow.network"))
        self.pathMonitor = monitor
    }

    // ─── Push notification registration ──────────────────────────────────────

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
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
            OnboardingView { self.showAuthChoice(in: overlay) }
        )
        transition(overlay, to: vc)
    }

    private func showAuthChoice(in overlay: UIWindow) {
        let vc = makeHostingController(
            AuthChoiceView(
                onRegister: { self.dismissOverlay(navigateTo: "/register") },
                onLogin:    { self.dismissOverlay(navigateTo: "/login") }
            )
        )
        transition(overlay, to: vc)
    }

    // ─── Dismiss + navigate ───────────────────────────────────────────────────

    private func dismissOverlay(navigateTo path: String?) {
        guard let overlay = overlayWindow else { return }

        guard isConnected else {
            showNetworkError(in: overlay, retryPath: path)
            return
        }

        // Paint the webview dark before the overlay fades so there is no
        // white flash during the crossfade into the Capacitor shell.
        if let bridgeVC = window?.rootViewController as? CAPBridgeViewController,
           let webView = bridgeVC.webView {
            webView.isOpaque = false
            webView.backgroundColor = DF.UIKit.bg
        }

        UIView.animate(withDuration: 0.45, delay: 0, options: .curveEaseOut) {
            overlay.alpha = 0
        } completion: { _ in
            overlay.isHidden = true
            self.overlayWindow = nil
            self.window?.makeKeyAndVisible()

            if let path = path {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.navigateWebView(to: path)
                }
            }
        }
    }

    private func showNetworkError(in overlay: UIWindow, retryPath: String?) {
        let vc = makeHostingController(
            NetworkErrorView {
                if self.isConnected {
                    self.dismissOverlay(navigateTo: retryPath)
                } else {
                    self.showNetworkError(in: overlay, retryPath: retryPath)
                }
            }
        )
        transition(overlay, to: vc)
    }

    private func navigateWebView(to path: String) {
        guard let bridgeVC = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridgeVC.webView else { return }
        // Explicit whitelist — only known internal routes. Paths come from
        // hardcoded literals or a validated deep-link handler below.
        let allowed: Set<String> = [
            "/register", "/login", "/dashboard",
            "/speaking", "/roadmap", "/vocabulary", "/news",
            "/onboarding", "/student/notifications",
        ]
        let allowedPrefixes = ["/speaking/", "/lesson/", "/student/", "/vocabulary/", "/roadmap/"]
        guard allowed.contains(path) || allowedPrefixes.contains(where: { path.hasPrefix($0) }) else { return }
        webView.evaluateJavaScript("window.location.replace('\(path)')")
    }

    // ─── Deep link handling ───────────────────────────────────────────────────

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Custom scheme: deutschflow://speaking → navigate to /speaking
        if url.scheme?.lowercased() == "deutschflow", let host = url.host {
            let path = "/" + host + url.path  // e.g. "/speaking" or "/student/notifications"
            navigateWebView(to: path)
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Universal Links: https://deutschflow.com/speaking → navigate to /speaking
        // Requires Associated Domains entitlement + server apple-app-site-association.
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
           let url = userActivity.webpageURL {
            let path = url.path.isEmpty ? "/" : url.path
            navigateWebView(to: path)
            return true
        }
        return false
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private func makeHostingController<V: View>(_ view: V) -> UIHostingController<V> {
        let vc = UIHostingController(rootView: view)
        vc.view.backgroundColor = DF.UIKit.bg
        return vc
    }

    private func transition(_ window: UIWindow, to vc: UIViewController) {
        UIView.transition(with: window, duration: 0.38, options: .transitionCrossDissolve) {
            window.rootViewController = vc
        }
    }

    // ─── Capacitor delegates ──────────────────────────────────────────────────

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}
}

// ─── UNUserNotificationCenter delegate ───────────────────────────────────────

extension AppDelegate: UNUserNotificationCenterDelegate {
    // Show notification banner even when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    // Forward tap on notification to Capacitor's notification router
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if let router = (window?.rootViewController as? CAPBridgeViewController)?.bridge?.notificationRouter {
            router.userNotificationCenter(center, didReceive: response, withCompletionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }
}
