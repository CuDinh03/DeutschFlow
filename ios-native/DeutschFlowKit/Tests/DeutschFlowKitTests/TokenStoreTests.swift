import XCTest
@testable import DeutschFlowKit

final class TokenStoreTests: XCTestCase {

    func testSetAccessAndClear() async {
        let store = TokenStore(baseURL: URL(string: "https://api.test")!, storage: InMemorySecureStorage())

        var loggedIn = await store.isLoggedIn
        XCTAssertFalse(loggedIn)

        await store.setTokens(AuthTokens(accessToken: "access-1", refreshToken: "refresh-1"))

        let token = await store.accessToken()
        XCTAssertEqual(token, "access-1")
        loggedIn = await store.isLoggedIn
        XCTAssertTrue(loggedIn)

        await store.clear()
        let cleared = await store.accessToken()
        XCTAssertNil(cleared)
    }

    func testInMemoryStorageRoundTrips() {
        let storage = InMemorySecureStorage()
        storage.set("v", for: "k")
        XCTAssertEqual(storage.get("k"), "v")
        storage.remove("k")
        XCTAssertNil(storage.get("k"))
    }
}
