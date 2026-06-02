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
}
