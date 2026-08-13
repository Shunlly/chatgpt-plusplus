class Chatgptplusplus < Formula
  desc "Tweak system for the OpenAI ChatGPT desktop app"
  homepage "https://github.com/Shunlly/chatgpt-plusplus"
  # 版本 tag 由 scripts/sync-version.mjs 自动同步，勿手工修改。
  url "https://github.com/Shunlly/chatgpt-plusplus.git",
      tag: "v1.0.25"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args(prefix: false),
           "--workspaces", "--include-workspace-root", "--ignore-scripts"
    system "npm", "run", "build"

    libexec.install Dir["*"]
    chmod 0755, libexec/"packages/installer/dist/cli.js"
    ["chatgptplusplus", "chatgpt-plusplus"].each do |cmd|
      (bin/cmd).write <<~EOS
        #!/bin/bash
        exec "#{Formula["node"].opt_bin}/node" "#{libexec}/packages/installer/dist/cli.js" "$@"
      EOS
      chmod 0755, bin/cmd
    end
  end

  def caveats
    <<~EOS
      Run `chatgptplusplus install` to patch ChatGPT/Codex.app.
      Run `chatgptplusplus update` to update ChatGPT++ from GitHub source.
    EOS
  end

  test do
    assert_match(/\d+\.\d+\.\d+/, shell_output("#{bin}/chatgptplusplus --version"))
    assert_match(/\d+\.\d+\.\d+/, shell_output("#{bin}/chatgpt-plusplus --version"))
  end
end
