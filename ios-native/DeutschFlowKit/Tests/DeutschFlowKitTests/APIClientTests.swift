import XCTest
@testable import DeutschFlowKit

/// Stubs URLSession responses so APIClient can be exercised without a network.
final class MockURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        guard let handler = MockURLProtocol.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }
    override func stopLoading() {}
}

private final class StubTokenProvider: TokenProviding, @unchecked Sendable {
    var token: String? = "old-token"
    private(set) var refreshCount = 0
    func accessToken() async -> String? { token }
    func refresh() async -> Bool { refreshCount += 1; token = "fresh-token"; return true }
    func clear() async { token = nil }
}

private final class CallBox: @unchecked Sendable { var count = 0 }

final class APIClientTests: XCTestCase {

    private func makeClient(tokenProvider: TokenProviding? = nil) -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return APIClient(baseURL: URL(string: "https://api.test")!,
                         session: URLSession(configuration: config),
                         tokenProvider: tokenProvider)
    }

    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    func testGetDecodesJSON() async throws {
        MockURLProtocol.handler = { req in
            let body = Data(#"{"planCode":"PRO","tier":"PREMIUM","startsAtUtc":null,"endsAtUtc":"2026-07-01T00:00:00Z"}"#.utf8)
            return (HTTPURLResponse(url: req.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, body)
        }
        let plan: MyPlan = try await makeClient().get("/api/auth/me/plan", authorized: false)
        XCTAssertEqual(plan.planCode, "PRO")
        XCTAssertEqual(plan.tier, "PREMIUM")
        XCTAssertEqual(plan.endsAtUtc, "2026-07-01T00:00:00Z")
    }

    func testHTTPErrorIsMapped() async {
        MockURLProtocol.handler = { req in
            (HTTPURLResponse(url: req.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!, Data("boom".utf8))
        }
        do {
            let _: MyPlan = try await makeClient().get("/x", authorized: false)
            XCTFail("expected an error")
        } catch let APIError.http(status, _) {
            XCTAssertEqual(status, 500)
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }

    func test401RefreshesTokenThenRetries() async throws {
        let box = CallBox()
        MockURLProtocol.handler = { req in
            box.count += 1
            if box.count == 1 {
                return (HTTPURLResponse(url: req.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
            }
            let body = Data(#"{"planCode":"PRO","tier":"PREMIUM","startsAtUtc":null,"endsAtUtc":null}"#.utf8)
            return (HTTPURLResponse(url: req.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, body)
        }
        let provider = StubTokenProvider()
        let plan: MyPlan = try await makeClient(tokenProvider: provider).get("/api/auth/me/plan")
        XCTAssertEqual(plan.planCode, "PRO")
        XCTAssertEqual(provider.refreshCount, 1)
        XCTAssertEqual(box.count, 2)
    }

    func test401WithoutProviderThrowsUnauthorized() async {
        MockURLProtocol.handler = { req in
            (HTTPURLResponse(url: req.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
        }
        do {
            let _: MyPlan = try await makeClient().get("/x")
            XCTFail("expected unauthorized")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }
}
