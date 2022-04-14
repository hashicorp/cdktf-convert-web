import React, { useEffect } from "react";
import "./App.css";
import ky from "ky";
import AceEditor from "react-ace";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";

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

    console.debug("Constructing URL", apiUrl);
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
    resetState: () => setState({ state: "idle" }),
  };
}

const options = [
  {
    value: "typescript",
    label: "TypeScript",
  },
  {
    value: "python",
    label: "Python",
  },
  {
    value: "java",
    label: "Java",
  },
  {
    value: "csharp",
    label: "C#",
  },
  // {
  //   value: "golang",
  //   label: "Go",
  // },
];

const allProviders: string[] = [
  "hashicorp/aws@~> 4.9.0",
  "hashicorp/google@ ~> 4.17.0",
  "hashicorp/azurerm@ ~> 3.1.0",
];

function App() {
  const [mutateUrl, setMutateUrl] = React.useState(false);
  const [currentHcl, setCurrentHcl] = React.useState(defaultHcl);
  const [language, setLanguage] = React.useState<string>("typescript");
  const [selectedProviders, setSelectedProviders] = React.useState<string[]>(
    []
  );
  const { state, trigger, resetState } = useGetConvertedCode();

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

  useEffect(() => {
    if (mutateUrl) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    console.debug("Getting values from URL params");
    const code = urlParams.get("code");
    if (code) {
      console.debug(`Setting code: ${code}`);
      setCurrentHcl(decodeURIComponent(code));
    }

    const language = urlParams.get("language");
    if (language) {
      console.debug(`Setting language: ${language}`);
      setLanguage(language);
    }

    const providers = urlParams.getAll("providers");
    console.debug({ providers });
    if (providers.length > 0) {
      console.debug(`Setting providers: ${providers}`);
      setSelectedProviders(providers);
    }
    console.debug(`Done reading the URL`);
    setMutateUrl(true);
  }, [
    mutateUrl,
    setMutateUrl,
    setCurrentHcl,
    setLanguage,
    setSelectedProviders,
  ]);

  // Write current state to url
  useEffect(() => {
    if (!mutateUrl) {
      return;
    }

    console.log("Adjusting URL based on content change", {
      currentHcl,
      language,
      selectedProviders,
    });

    const url = new URL("http://example.com/");
    url.searchParams.set("language", language);
    selectedProviders.forEach((provider) =>
      url.searchParams.append("providers", provider)
    );
    url.searchParams.set("code", encodeURIComponent(currentHcl));

    window.history.replaceState({}, "", url.search);
  }, [mutateUrl, currentHcl, language, selectedProviders]);

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
            <Select
              onChange={(e) => {
                setLanguage(e?.value!);
                resetState();
              }}
              value={options.find((opt) => opt.value === language)}
              options={options}
              className="select"
            />
          </div>

          <div className="select-group">
            <label htmlFor="providers">Providers</label>

            <CreatableSelect
              isMulti
              value={selectedProviders.map((provider) => ({
                value: provider,
                label: provider,
              }))}
              onChange={(items) => {
                setSelectedProviders(items.map((item) => item.value));
              }}
              options={allProviders.map((provider) => ({
                value: provider,
                label: provider,
              }))}
              className="select select-broad"
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
              trigger(language, selectedProviders, currentHcl);
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
