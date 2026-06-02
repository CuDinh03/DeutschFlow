import XCTest
@testable import DeutschFlowKit

/// Locks the client DTOs to the backend wire shapes (AppleIapController / AuthMePlanController).
final class ModelDecodingTests: XCTestCase {

    func testAppleActivationResultDecodes() throws {
        let json = Data(#"{"planCode":"ULTRA","endsAt":"2026-07-01T00:00:00Z"}"#.utf8)
        let result = try JSONDecoder().decode(AppleActivationResult.self, from: json)
        XCTAssertEqual(result.planCode, "ULTRA")
        XCTAssertEqual(result.endsAt, "2026-07-01T00:00:00Z")
    }

    func testAppleProductListDecodes() throws {
        let json = Data("""
        [
          {"productId":"com.deutschflow.app.pro.monthly","planCode":"PRO","durationMonths":1},
          {"productId":"com.deutschflow.app.ultra.yearly","planCode":"ULTRA","durationMonths":12}
        ]
        """.utf8)
        let products = try JSONDecoder().decode([AppleProductInfo].self, from: json)
        XCTAssertEqual(products.count, 2)
        XCTAssertEqual(products[0].productId, "com.deutschflow.app.pro.monthly")
        XCTAssertEqual(products[1].durationMonths, 12)
    }

    func testAccountTokenDecodes() throws {
        let json = Data(#"{"appAccountToken":"00000000-0000-0000-0000-0000000000aa"}"#.utf8)
        let token = try JSONDecoder().decode(AppleAccountToken.self, from: json)
        XCTAssertEqual(token.appAccountToken, "00000000-0000-0000-0000-0000000000aa")
    }

    func testMyPlanDecodesWithNullDates() throws {
        let json = Data(#"{"planCode":"FREE","tier":"BASIC","startsAtUtc":null,"endsAtUtc":null}"#.utf8)
        let plan = try JSONDecoder().decode(MyPlan.self, from: json)
        XCTAssertEqual(plan.planCode, "FREE")
        XCTAssertNil(plan.endsAtUtc)
    }

    /// Locks the iOS DTO against the exact shape backend `AuthResponse` writes (9 fields, two optional).
    /// Regression guard: until 2026-06-02 the iOS side decoded login as a 2-field AuthTokens which
    /// silently failed on every login.
    func testAuthResponseDecodesAllFields() throws {
        let json = Data("""
        {
          "accessToken": "eyJ.access",
          "refreshToken": "eyJ.refresh",
          "userId": 42,
          "email": "alice@example.com",
          "displayName": "Alice",
          "role": "STUDENT",
          "locale": "vi",
          "learningTargetLevel": "B2",
          "industry": "tech"
        }
        """.utf8)
        let response = try JSONDecoder().decode(AuthResponse.self, from: json)
        XCTAssertEqual(response.accessToken, "eyJ.access")
        XCTAssertEqual(response.userId, 42)
        XCTAssertEqual(response.role, "STUDENT")
        XCTAssertEqual(response.learningTargetLevel, "B2")
        XCTAssertEqual(response.tokens.refreshToken, "eyJ.refresh")
        XCTAssertEqual(response.profile.displayName, "Alice")
    }

    func testAuthResponseDecodesWithNullOptionalFields() throws {
        let json = Data("""
        {"accessToken":"a","refreshToken":"b","userId":1,"email":"x@y.z","displayName":"X",
         "role":"STUDENT","locale":"vi","learningTargetLevel":null,"industry":null}
        """.utf8)
        let response = try JSONDecoder().decode(AuthResponse.self, from: json)
        XCTAssertNil(response.learningTargetLevel)
        XCTAssertNil(response.industry)
    }

    func testLoginRequestEncodesCanonically() throws {
        let request = LoginRequest(email: "alice@example.com", password: "secret")
        let data = try JSONEncoder().encode(request)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(object?["email"] as? String, "alice@example.com")
        XCTAssertEqual(object?["password"] as? String, "secret")
    }

    func testRefreshRequestEncodesCanonically() throws {
        let request = RefreshRequest(refreshToken: "refresh-1")
        let data = try JSONEncoder().encode(request)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(object?["refreshToken"] as? String, "refresh-1")
    }
}
