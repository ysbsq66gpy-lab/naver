const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Naver 블로그 검색 API
 */
async function searchNaverBlogs(query, display = 3) {
    try {
        const response = await axios.get(`https://openapi.naver.com/v1/search/blog.json`, {
            params: { query, display, sort: 'date' },
            headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
            },
            timeout: 5000
        });
        return response.data.items || [];
    } catch (error) {
        console.error('Naver Search API Failed:', error.message);
        return [];
    }
}

/**
 * 블로그 본문 수집
 */
async function fetchBlogContent(url) {
    try {
        const urlObj = new URL(url);
        let blogId, logNo;
        if (urlObj.hostname === 'blog.naver.com') {
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            blogId = pathParts[0];
            logNo = pathParts[1];
        } else if (urlObj.hostname.endsWith('blog.me')) {
            blogId = urlObj.hostname.split('.')[0];
            logNo = urlObj.pathname.split('/').filter(p => p)[0];
        }

        if (!blogId || !logNo) return null;

        const mobileUrl = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;
        const response = await axios.get(mobileUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
            },
            timeout: 5000
        });

        const $ = cheerio.load(response.data);
        const text = $('.se-main-container').text().trim() || $('#post-view-' + logNo).text().trim() || $('.post_content').text().trim();
        return text;
    } catch (error) {
        return null;
    }
}

module.exports = async (req, res) => {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { q } = req.query;
    const query = q || '네이버쇼핑';

    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is missing.' });
    }

    try {
        const blogs = await searchNaverBlogs(query, 3);
        const results = [];

        for (const blog of blogs) {
            const content = await fetchBlogContent(blog.link);
            results.push({
                title: blog.title.replace(/<[^>]*>?/gm, ''),
                link: blog.link,
                postdate: blog.postdate,
                preview: content ? content.substring(0, 300) : '본문을 가져올 수 없습니다.'
            });
        }

        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};
