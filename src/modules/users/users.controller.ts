import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  // Future: GET /users/me, PATCH /users/me (profile, change password), etc.
}
