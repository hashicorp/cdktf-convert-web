import React, { useEffect } from "react";
import "./App.css";
import ky from "ky";
import AceEditor from "react-ace";

import "ace-builds/src-noconflict/mode-terraform";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/mode-typescript";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-csharp";
import "ace-builds/src-noconflict/mode-golang";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";

const { REACT_APP_BACKEND_URL } = process.env;

const apiUrl =
  REACT_APP_BACKEND_URL ||
  `${window.location.protocol}//${window.location.host}/`;

const defaultHcl = `resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}`;

type State =
  | {
      state: "idle";
    }
  | {
      state: "triggered";
      language: string;
      providers: string[];
      codeToConvert: string;
    }
  | {
      state: "loading";
    }
  | {
      state: "error";
      error: string;
    }
  | {
      state: "success";
      code: string;
    };

function useGetConvertedCode() {
  const [state, setState] = React.useState<State>({ state: "idle" });

  useEffect(() => {
    if (state.state !== "triggered") {
      return;
    }
    setState({ state: "loading" });

    const url = new URL(`${apiUrl}/`);
    url.searchParams.set("language", state.language);
    state.providers.forEach((provider) =>
      url.searchParams.append("provider", provider)
    );
    console.debug("Requesting converted code", url, state.codeToConvert, state);
    ky(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeout: 300000,
      body: JSON.stringify({
        code: btoa(state.codeToConvert),
      }),
    })
      .json()
      .then((data) => {
        console.debug("Received converted code", data);
        setState({ state: "success", code: (data as any).code });
      })
      .catch((error) => {
        console.error("Error while converting code", error);
        setState({ state: "error", error: error.message });
      });
  }, [state]);

  return {
    state,
    trigger: (language: string, providers: string[], codeToConvert: string) =>
      setState({ state: "triggered", language, providers, codeToConvert }),
  };
}

function App() {
  const [currentHcl, setCurrentHcl] = React.useState(defaultHcl);
  const { state, trigger } = useGetConvertedCode();

  let targetContent = "...";
  if (state.state === "success") {
    targetContent = state.code;
  }

  if (state.state === "error") {
    targetContent = `Error converting code: ${state.error}`;
  }

  if (state.state === "loading") {
    targetContent = "Converting code...";
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>CDKTF Convert</h1>
      </header>
      <aside className="App-sidebar">
        <h2>Options</h2>

        <div className="App-sidebar-content">
          <div className="select-group">
            <label htmlFor="language">Language</label>
            <select id="language">
              <option value="typescript">Typescript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="csharp">C#</option>
              <option disabled value="go">
                Go (Not supported right now)
              </option>
            </select>
          </div>

          <div className="select-group">
            <label htmlFor="providers">Providers</label>
            <input
              type="text"
              id="providers"
              placeholder="TODO: make this a multi item entry / autocomplete thing"
            />
          </div>
        </div>
      </aside>

      <main>
        <section>
          <h2>Terraform HCL input</h2>

          <AceEditor
            mode="terraform"
            theme="github"
            onChange={(code) => {
              setCurrentHcl(code);
            }}
            value={currentHcl}
            name="terraform"
          />

          <button
            disabled={state.state === "loading"}
            onClick={() => {
              trigger("typescript", ["hashicorp/aws@=4.9.0"], currentHcl);
            }}
          >
            Convert to CDKTF
          </button>
        </section>

        <section>
          <h2>CDKTF Content</h2>
          {state.state === "error" && (
            <p>Error while converting code: {state.error}</p>
          )}

          <AceEditor
            mode="typescript"
            theme="github"
            readOnly={true}
            value={targetContent}
            name="cdktf"
          />
        </section>
      </main>
    </div>
  );
}

export default App;