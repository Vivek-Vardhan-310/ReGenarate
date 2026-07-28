import asyncio
import httpx
from app.config.settings import settings
from app.services.jdoodle import JDoodleService

async def main():
    print(f"Testing with CLIENT_ID: {settings.JDOODLE_CLIENT_ID[:5]}... Secret length: {len(settings.JDOODLE_CLIENT_SECRET)}")
    service = JDoodleService()
    print("Is configured:", service.is_configured())
    try:
        res = await service.execute_code(code="print('Hello from JDoodle live test!')", language="python")
        print("RESULT:", res)
    except Exception as e:
        print("ERROR:", type(e), e)

if __name__ == "__main__":
    asyncio.run(main())
