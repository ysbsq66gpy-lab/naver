require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

/**
 * Naver 블로그 검색 API를 사용하여 블로그 목록을 가져옵니다.
 */
async function searchNaverBlogs(query, display = 5) {
    try {
        const response = await axios.get(`https://openapi.naver.com/v1/search/blog.json`, {
            params: {
                query: query,
                display: display,
                sort: 'date'
            },
            headers: {
                'X-Naver-Client-Id': NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
            }
        });
        return response.data.items;
    } catch (error) {
        console.error('Naver Search API Failed:', error.response ? error.response.data : error.message);
        return [];
    }
}

/**
 * 블로그 URL에서 실제 본문 내용을 파싱합니다.
 * Naver 블로그는 iframe 구조이므로 직접 본문 URL을 구성해야 합니다.
 */
async function fetchBlogContent(url) {
    try {
        const urlObj = new URL(url);
        let blogId, logNo;

        if (urlObj.hostname === 'blog.naver.com') {
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            blogId = pathParts[0];
            logNo = pathParts[1];
        }

        if (!blogId || !logNo) {
            console.log(`Could not parse blogId or logNo from ${url}`);
            return null;
        }

        // iframe을 제외한 실제 본문 URL (모바일 버전이 파싱하기 더 쉬움)
        const mobileUrl = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;

        const response = await axios.get(mobileUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        // Naver 블로그 본문 텍스트 추출
        let content = $('.se-main-container').text().trim();
        if (!content) {
            content = $('#post-view-' + logNo).text().trim();
        }
        if (!content) {
            content = $('.post_content').text().trim();
        }

        return content;
    } catch (error) {
        console.error(`Fetch failed for ${url}:`, error.message);
        return null;
    }
}

/**
 * 메인 실행 함수
 */
async function main() {
    const query = '네이버쇼핑 파트너 제안';

    console.log(`🔍 '${query}' 검색 중...`);
    const blogs = await searchNaverBlogs(query, 3);

    if (blogs.length === 0) {
        console.log('검색 결과가 없습니다.');
        return;
    }

    for (const blog of blogs) {
        console.log(`\n-----------------------------------------`);
        console.log(`📝 제목: ${blog.title.replace(/<[^>]*>?/gm, '')}`);
        console.log(`🔗 링크: ${blog.link}`);
        console.log(`📅 날짜: ${blog.postdate}`);

        console.log(`⏳ 본문 수집 중...`);
        const content = await fetchBlogContent(blog.link);

        if (content) {
            console.log(`📄 본문 내용 (앞부분 200자):`);
            console.log(content.substring(0, 200).replace(/\n/g, ' ') + '...');
        } else {
            console.log(`❌ 본문을 가져오지 못했습니다.`);
        }
    }
}

main();
