import "cdktf/lib/testing/adapters/jest"; // Load types for expect matchers
import { Testing } from "cdktf";
import { ConvertPage, getDevelopmentPrefix } from "../main";

describe("ConvertPage", () => {
  it("can synthesize", () => {
    const app = Testing.app();
    process.env.USER_NAME = "test";
    const stack = new ConvertPage(app, "convert", getDevelopmentPrefix());
    expect(Testing.synth(stack)).toMatchSnapshot();
  });
});
