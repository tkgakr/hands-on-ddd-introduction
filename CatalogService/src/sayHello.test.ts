import { sayHello } from "./sayHello";

test("sayHello", () => {
    expect(sayHello("World")).toBe("Hello World!");
});