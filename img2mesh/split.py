import re
import os

def split_html_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. 提取 CSS
    # 查找所有 <style> 标签的内容
    css_content = ""
    def replace_css(match):
        nonlocal css_content
        css_content += match.group(1).strip() + "\n\n"
        return "" # 移除原标签，稍后统一添加 link

    # 移除 <style>...</style> 并收集内容
    content_no_css = re.sub(r'<style[^>]*>(.*?)</style>', replace_css, content, flags=re.DOTALL)

    # 2. 提取 JS
    # 查找所有不带 src 属性的 <script> 标签的内容
    js_content = ""
    def replace_js(match):
        nonlocal js_content
        # 排除带有 src="..." 的 script 标签（引用外部库的不动）
        if 'src=' in match.group(0):
            return match.group(0)
        js_content += match.group(1).strip() + "\n\n"
        return "" # 移除原标签，稍后统一添加 script src

    content_final = re.sub(r'<script[^>]*>(.*?)</script>', replace_js, content_no_css, flags=re.DOTALL)

    # 3. 重新组装 HTML
    # 在 </head> 前插入 CSS 链接
    if css_content:
        link_tag = '<link rel="stylesheet" href="style.css">\n'
        if '</head>' in content_final:
            content_final = content_final.replace('</head>', f'{link_tag}</head>')
        else:
            # 如果没找到 head，就插在 body 前
            content_final = link_tag + content_final

    # 在 </body> 前插入 JS 脚本链接
    if js_content:
        script_tag = '<script src="script.js"></script>\n'
        if '</body>' in content_final:
            content_final = content_final.replace('</body>', f'{script_tag}</body>')
        else:
            content_final += script_tag

    # 4. 保存文件
    # 保存 index.html (GitHub Pages 默认入口)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content_final)
    
    # 保存 style.css
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(css_content)

    # 保存 script.js
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

    print("✅ 拆分完成！已生成 index.html, style.css, script.js")

# 运行拆分
if __name__ == "__main__":
    # 请确保您下载的文件名是 img2mesh.html
    if os.path.exists('img2mesh.html'):
        split_html_file('img2mesh.html')
    else:
        print("❌ 未找到 img2mesh.html，请确保文件在当前目录下。")