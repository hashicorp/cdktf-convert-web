import "cdktf/lib/testing/adapters/jest"; // Load types for expect matchers
import { Testing } from "cdktf";
import { ConvertPage } from "../main";
describe("ConvertPage", () => {
  it("can synthesize", () => {
    const app = Testing.app();
    const stack = new ConvertPage(app, "convert");
    expect(Testing.synth(stack)).toMatchSnapshot();
  });
});
