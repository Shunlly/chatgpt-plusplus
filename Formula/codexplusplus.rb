class Codexplusplus < Formula
  desc "Tweak system for the OpenAI Codex desktop app"
  homepage "https://github.com/b-nnett/codex-plusplus"
  url "https://github.com/b-nnett/codex-plusplus.git",
      tag: "v0.1.4"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args(prefix: false),
           "--workspaces", "--include-workspace-root", "--ignore-scripts"
    system "npm", "run", "build"

    libexec.install Dir["*"]
    chmod 0755, libexec/"packages/installer/dist/cli.js"
    ["codexplusplus", "codex-plusplus"].each do |cmd|
      (bin/cmd).write <<~EOS
        #!/bin/bash
        exec "#{Formula["node"].opt_bin}/node" "#{libexec}/packages/installer/dist/cli.js" "$@"
      EOS
      chmod 0755, bin/cmd
    end
  end

  def caveats
    <<~EOS
      Run `codexplusplus install` to patch Codex.app.
      Run `codexplusplus update` to update Codex++ from GitHub source.
    EOS
  end

  test do
    assert_match(/codex-plusplus, \d+\.\d+\.\d+/, shell_output("#{bin}/codexplusplus --version"))
    assert_match(/codex-plusplus, \d+\.\d+\.\d+/, shell_output("#{bin}/codex-plusplus --version"))
  end
end
