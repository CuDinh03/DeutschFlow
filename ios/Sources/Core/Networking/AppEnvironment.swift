import Foundation

/// Backend environments. Base URLs mirror the OpenAPI `servers` block in the backend `OpenApiConfig`.
enum AppEnvironment {
    case production, staging, local

    var baseURL: URL {
        switch self {
        case .production: URL(string: "https://api.mydeutschflow.com")!
        case .staging: URL(string: "https://staging-api.mydeutschflow.com")! // TODO(admin): confirm host
        case .local: URL(string: "http://localhost:8080")!
        }
    }

    /// TODO(iOS): drive from build configuration (Debug → local/staging, Release → production).
    static let current: AppEnvironment = .production
}
